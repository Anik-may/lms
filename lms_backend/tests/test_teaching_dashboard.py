"""End-to-end run of every teacher-dashboard route against a real Postgres.

    DATABASE_URL=postgresql+asyncpg://lms:lms@localhost:55440/lms pytest tests
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import AsyncSessionLocal
from app.main import app
from app.services import rbac_service

pytestmark = pytest.mark.asyncio(loop_scope="session")
PW = "password123"
RUN = uuid.uuid4().hex[:8]


async def _user(c, name, teacher=False):
    email = f"{name}-{RUN}@test.io"
    r = await c.post("/api/v1/auth/register", json={"email": email, "password": PW, "display_name": name})
    assert r.status_code == 201, r.text
    if teacher:
        async with AsyncSessionLocal() as db:
            await rbac_service.grant_role(db, uuid.UUID(r.json()["id"]), "TEACHER")
            await db.commit()
    t = (await c.post("/api/v1/auth/login", json={"email": email, "password": PW})).json()
    return {"id": r.json()["id"], "email": email, "h": {"Authorization": f"Bearer {t['access_token']}"}}


@pytest.fixture(scope="session")
async def c():
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
            yield client


async def test_full_teacher_dashboard(c):
    T = "/api/v1"
    teacher = await _user(c, "teacher", teacher=True)
    co = await _user(c, "coteacher")
    student = await _user(c, "student")
    outsider = await _user(c, "outsider")

    # empty dashboard for a brand-new teacher
    r = await c.get(f"{T}/teaching/overview", headers=teacher["h"])
    assert r.status_code == 200 and r.json()["course_count"] == 0
    assert (await c.get(f"{T}/teaching/overview")).status_code == 401

    # create + publish + price
    r = await c.post(f"{T}/courses", headers=teacher["h"], json={
        "title": "Py", "language_code": "en", "slug": f"py-{RUN}"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    assert (await c.patch(f"{T}/courses/{cid}/status", headers=teacher["h"], json={"status": "PUBLISHED"})).status_code == 200
    r = await c.put(f"{T}/courses/{cid}/price", headers=teacher["h"], json={"amount": "100"})
    assert r.status_code == 200, r.text
    assert (await c.put(f"{T}/courses/{cid}/price", headers=outsider["h"], json={"amount": "1"})).status_code in (403, 404)

    r = await c.get(f"{T}/teaching/courses", headers=teacher["h"])
    assert [x["id"] for x in r.json()] == [cid]
    assert (await c.get(f"{T}/teaching/courses", headers=outsider["h"])).json() == []

    # instructors
    r = await c.post(f"{T}/courses/{cid}/instructors", headers=teacher["h"], json={"email": co["email"]})
    assert r.status_code == 201 and len(r.json()) == 2
    assert (await c.post(f"{T}/courses/{cid}/instructors", headers=co["h"], json={"email": outsider["email"]})).status_code == 403
    assert (await c.post(f"{T}/courses/{cid}/instructors", headers=teacher["h"], json={"email": "no@one.io"})).status_code == 404
    assert (await c.get(f"{T}/courses/{cid}/instructors", headers=co["h"])).status_code == 200
    assert (await c.get(f"{T}/teaching/courses", headers=co["h"])).json()[0]["id"] == cid

    # student buys the course -> earnings
    assert (await c.post(f"{T}/cart/items", headers=student["h"], json={"course_id": cid})).status_code == 201
    r = await c.post(f"{T}/checkout", headers=student["h"], json={"idempotency_key": f"k-{RUN}"})
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    r = await c.post(f"{T}/orders/{oid}/pay", headers=student["h"], json={"provider": "mock", "provider_payment_id": f"p-{RUN}"})
    assert r.status_code == 200, r.text

    # students / analytics
    r = await c.get(f"{T}/courses/{cid}/students", headers=teacher["h"])
    assert r.status_code == 200 and len(r.json()) == 1
    assert (await c.get(f"{T}/courses/{cid}/students", headers=outsider["h"])).status_code in (403, 404)
    r = await c.get(f"{T}/courses/{cid}/analytics", headers=teacher["h"])
    assert r.status_code == 200 and r.json()["enrollment_count"] == 1 and r.json()["sales_count"] == 1

    # student reviews + Q&A
    assert (await c.put(f"{T}/courses/{cid}/reviews/me", headers=outsider["h"], json={"rating": 5})).status_code == 403
    assert (await c.put(f"{T}/courses/{cid}/reviews/me", headers=student["h"], json={"rating": 4, "body": "good"})).status_code == 200
    assert (await c.put(f"{T}/courses/{cid}/reviews/me", headers=student["h"], json={"rating": 5, "body": "great"})).status_code == 200
    r = await c.get(f"{T}/teaching/reviews", headers=teacher["h"])
    j = r.json()
    assert j["review_count"] == 1 and j["average_rating"] == 5 and j["reviews"][0]["body"] == "great"
    assert (await c.get(f"{T}/teaching/reviews?rating=1", headers=teacher["h"])).json()["reviews"] == []

    r = await c.post(f"{T}/courses/{cid}/discussions", headers=student["h"], json={"title": "Help?", "body": "How?"})
    assert r.status_code == 201, r.text
    tid = r.json()["thread_id"]
    r = await c.get(f"{T}/teaching/questions?unanswered=true", headers=teacher["h"])
    assert [q["thread_id"] for q in r.json()] == [tid]
    assert (await c.get(f"{T}/teaching/questions/{tid}", headers=outsider["h"])).status_code == 404
    r = await c.post(f"{T}/teaching/questions/{tid}/replies", headers=teacher["h"], json={"body": "Like this"})
    assert r.status_code == 201 and len(r.json()["posts"]) == 2
    assert (await c.get(f"{T}/teaching/questions?unanswered=true", headers=teacher["h"])).json() == []
    r = await c.patch(f"{T}/teaching/questions/{tid}", headers=teacher["h"], json={"status": "RESOLVED", "is_pinned": True})
    assert r.status_code == 200 and r.json()["thread"]["status"] == "RESOLVED" and r.json()["thread"]["is_pinned"]
    assert (await c.patch(f"{T}/teaching/questions/{tid}", headers=outsider["h"], json={"is_pinned": False})).status_code == 404

    # earnings + payouts
    r = await c.get(f"{T}/teaching/earnings", headers=teacher["h"])
    e = r.json()
    assert r.status_code == 200 and e["total_earned"] > 0 and e["available_balance"] == e["total_earned"]
    assert (await c.post(f"{T}/teaching/payouts", headers=teacher["h"], json={"amount": e["total_earned"] + 1})).status_code == 422
    r = await c.post(f"{T}/teaching/payouts", headers=teacher["h"], json={})
    assert r.status_code == 201 and r.json()["status"] == "PENDING"
    assert (await c.get(f"{T}/teaching/earnings", headers=teacher["h"])).json()["available_balance"] == 0
    assert (await c.post(f"{T}/teaching/payouts", headers=teacher["h"], json={})).status_code == 422
    assert len((await c.get(f"{T}/teaching/payouts", headers=teacher["h"])).json()) == 1

    # submissions, profile, overview
    assert (await c.get(f"{T}/teaching/submissions", headers=teacher["h"])).json() == []
    r = await c.patch(f"{T}/teaching/profile", headers=teacher["h"], json={"professional_title": "Dr"})
    assert r.status_code == 200 and r.json()["professional_title"] == "Dr"
    assert (await c.get(f"{T}/teaching/profile", headers=teacher["h"])).json()["professional_title"] == "Dr"
    o = (await c.get(f"{T}/teaching/overview", headers=teacher["h"])).json()
    assert o["course_count"] == 1 and o["published_course_count"] == 1 and o["student_count"] == 1

    # remove co-instructor
    r = await c.delete(f"{T}/courses/{cid}/instructors/{co['id']}", headers=teacher["h"])
    assert r.status_code == 200 and len(r.json()) == 1
