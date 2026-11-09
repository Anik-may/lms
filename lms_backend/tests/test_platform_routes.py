"""Non-payment routes: notifications, wishlist, certificates, taxonomy, search, reviews,
discussions, moderation and instructor verification."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import update

from app.core.database import AsyncSessionLocal
from app.models.progress import CourseProgress
from app.services import rbac_service
from tests.test_teaching_dashboard import PW, RUN, _user, c  # noqa: F401

pytestmark = pytest.mark.asyncio(loop_scope="session")
T = "/api/v1"


async def test_platform_routes(c):  # noqa: F811
    teacher = await _user(c, "t2", teacher=True)
    student = await _user(c, "s2")
    other = await _user(c, "o2")
    admin = await _user(c, "a2")
    async with AsyncSessionLocal() as db:
        await rbac_service.grant_role(db, uuid.UUID(admin["id"]), "PLATFORM_ADMIN")
        await db.commit()
    # tokens carry roles at request time, so no re-login needed

    # course (free) + taxonomy
    r = await c.post(f"{T}/courses", headers=teacher["h"], json={"title": "Searchable Rust", "language_code": "en", "slug": f"rust-{RUN}", "level": "BEGINNER"})
    cid = r.json()["id"]
    await c.patch(f"{T}/courses/{cid}/status", headers=teacher["h"], json={"status": "PUBLISHED"})
    assert (await c.post(f"{T}/categories", headers=teacher["h"], json={"name": "Prog"})).status_code == 403
    r = await c.post(f"{T}/categories", headers=admin["h"], json={"name": f"Programming {RUN}"})
    assert r.status_code == 201, r.text
    cat = r.json()["id"]
    assert (await c.post(f"{T}/categories", headers=admin["h"], json={"name": f"Programming {RUN}"})).status_code == 409
    assert cat in [x["id"] for x in (await c.get(f"{T}/categories")).json()]
    tag = (await c.post(f"{T}/tags", headers=teacher["h"], json={"name": f"Rust {RUN}"})).json()["id"]
    r = await c.put(f"{T}/courses/{cid}/taxonomy", headers=teacher["h"], json={"category_ids": [cat], "tag_ids": [tag]})
    assert r.status_code == 200 and len(r.json()["tags"]) == 1
    assert (await c.put(f"{T}/courses/{cid}/taxonomy", headers=other["h"], json={})).status_code in (403, 404)
    assert (await c.put(f"{T}/courses/{cid}/taxonomy", headers=teacher["h"], json={"category_ids": [str(uuid.uuid4())]})).status_code == 422
    assert (await c.get(f"{T}/courses/{cid}/taxonomy")).json()["categories"][0]["id"] == cat

    # catalog search
    ids = lambda r: [x["id"] for x in r.json()]  # noqa: E731
    assert cid in ids(await c.get(f"{T}/courses?q=rust&category_id={cat}&level=beginner&language=en"))
    assert cid not in ids(await c.get(f"{T}/courses?q=zzzzzz"))
    assert cid not in ids(await c.get(f"{T}/courses?level=advanced"))
    assert (await c.get(f"{T}/courses?sort=popular")).status_code == 200

    # wishlist
    assert (await c.put(f"{T}/wishlist/{cid}", headers=student["h"])).status_code == 204
    assert (await c.put(f"{T}/wishlist/{cid}", headers=student["h"])).status_code == 204
    assert ids(await c.get(f"{T}/wishlist", headers=student["h"])) == [cid]
    assert (await c.delete(f"{T}/wishlist/{cid}", headers=student["h"])).status_code == 204
    assert (await c.get(f"{T}/wishlist", headers=student["h"])).json() == []

    # enroll (free), certificate gating
    assert (await c.post(f"{T}/courses/{cid}/enroll", headers=student["h"])).status_code == 201
    assert (await c.get(f"{T}/courses?sort=popular&q=rust")).json()[0]["enrollment_count"] == 1
    assert (await c.post(f"{T}/courses/{cid}/certificate", headers=student["h"])).status_code == 409
    async with AsyncSessionLocal() as db:
        await db.execute(update(CourseProgress).where(CourseProgress.course_id == uuid.UUID(cid)).values(completed_at=datetime.now(timezone.utc)))
        await db.commit()
    r = await c.post(f"{T}/courses/{cid}/certificate", headers=student["h"])
    assert r.status_code == 201, r.text
    code = r.json()["verification_code"]
    assert (await c.post(f"{T}/courses/{cid}/certificate", headers=student["h"])).json()["verification_code"] == code
    assert len((await c.get(f"{T}/certificates/me", headers=student["h"])).json()) == 1
    v = await c.get(f"{T}/certificates/verify/{code}")
    assert v.status_code == 200 and v.json()["holder_name"] == "s2"
    assert (await c.get(f"{T}/certificates/verify/nope")).status_code == 404

    # reviews: rating kept in sync, helpful, report, moderation
    r = await c.put(f"{T}/courses/{cid}/reviews/me", headers=student["h"], json={"rating": 2, "body": "rude text"})
    assert r.status_code == 200, r.text
    assert float((await c.get(f"{T}/courses/{cid}")).json()["rating_average"]) == 2
    pub = (await c.get(f"{T}/courses/{cid}/reviews")).json()
    assert len(pub) == 1
    rid = pub[0]["id"]
    assert (await c.put(f"{T}/reviews/{rid}/helpful", headers=student["h"])).status_code == 422
    assert (await c.put(f"{T}/reviews/{rid}/helpful", headers=other["h"])).status_code == 204
    assert (await c.get(f"{T}/courses/{cid}/reviews")).json()[0]["helpful_count"] == 1
    assert (await c.delete(f"{T}/reviews/{rid}/helpful", headers=other["h"])).status_code == 204
    r = await c.post(f"{T}/reviews/{rid}/report", headers=other["h"], json={"reason": "abusive"})
    assert r.status_code == 201
    assert (await c.get(f"{T}/admin/review-reports", headers=other["h"])).status_code == 403
    reps = (await c.get(f"{T}/admin/review-reports", headers=admin["h"])).json()
    rep = next(x for x in reps if x["review_id"] == rid)
    r = await c.patch(f"{T}/admin/review-reports/{rep['id']}", headers=admin["h"], json={"action": "HIDE_REVIEW"})
    assert r.status_code == 200 and r.json()["review_status"] == "HIDDEN"
    assert (await c.get(f"{T}/courses/{cid}/reviews")).json() == []
    assert float((await c.get(f"{T}/courses/{cid}")).json()["rating_average"]) == 0
    r = await c.put(f"{T}/courses/{cid}/reviews/me", headers=student["h"], json={"rating": 5})
    assert (await c.delete(f"{T}/courses/{cid}/reviews/me", headers=student["h"])).status_code == 204
    assert (await c.delete(f"{T}/courses/{cid}/reviews/me", headers=student["h"])).status_code == 404

    # discussions (student side) + notification on instructor reply
    tid = (await c.post(f"{T}/courses/{cid}/discussions", headers=student["h"], json={"title": "Q", "body": "b"})).json()["thread_id"]
    assert (await c.get(f"{T}/courses/{cid}/discussions", headers=other["h"])).status_code == 403
    assert len((await c.get(f"{T}/courses/{cid}/discussions", headers=student["h"])).json()) == 1
    assert len((await c.get(f"{T}/discussions/{tid}", headers=student["h"])).json()["posts"]) == 1
    await c.post(f"{T}/teaching/questions/{tid}/replies", headers=teacher["h"], json={"body": "answer"})
    d = (await c.get(f"{T}/discussions/{tid}", headers=student["h"])).json()
    assert len(d["posts"]) == 2
    mine = next(p for p in d["posts"] if not p["is_instructor_answer"])
    assert (await c.delete(f"{T}/discussions/posts/{mine['id']}", headers=other["h"])).status_code == 404
    assert (await c.delete(f"{T}/discussions/posts/{mine['id']}", headers=student["h"])).status_code == 204

    # notifications
    n = (await c.get(f"{T}/notifications", headers=student["h"])).json()
    assert n["unread_count"] >= 2 and any(i["type"] == "QUESTION_ANSWERED" for i in n["items"])
    nid = n["items"][0]["id"]
    assert (await c.post(f"{T}/notifications/{nid}/read", headers=student["h"])).json()["read_at"]
    assert (await c.post(f"{T}/notifications/{nid}/read", headers=other["h"])).status_code == 404
    assert (await c.post(f"{T}/notifications/read-all", headers=student["h"])).status_code == 204
    assert (await c.get(f"{T}/notifications?unread_only=true", headers=student["h"])).json()["unread_count"] == 0
    assert (await c.delete(f"{T}/notifications/{nid}", headers=student["h"])).status_code == 204

    # instructor verification
    r = await c.post(f"{T}/teaching/verification", headers=teacher["h"], json={"verification_type": "IDENTITY", "details": "id"})
    assert r.status_code == 201, r.text
    vid = r.json()["id"]
    assert (await c.post(f"{T}/teaching/verification", headers=teacher["h"], json={"verification_type": "IDENTITY"})).status_code == 409
    assert len((await c.get(f"{T}/teaching/verification", headers=teacher["h"])).json()) == 1
    assert (await c.get(f"{T}/admin/verifications", headers=teacher["h"])).status_code == 403
    assert vid in ids(await c.get(f"{T}/admin/verifications", headers=admin["h"]))
    r = await c.patch(f"{T}/admin/verifications/{vid}", headers=admin["h"], json={"decision": "APPROVED"})
    assert r.status_code == 200 and r.json()["status"] == "APPROVED"
    assert (await c.patch(f"{T}/admin/verifications/{vid}", headers=admin["h"], json={"decision": "REJECTED"})).status_code == 409
    assert (await c.get(f"{T}/teaching/profile", headers=teacher["h"])).json()["verification_status"] == "VERIFIED"
