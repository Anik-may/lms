"""Admin dashboard routes: stats, user search/filters, roles, suspension, all courses, orders."""

import uuid

import pytest

from app.core.database import AsyncSessionLocal
from app.services import rbac_service
from tests.test_teaching_dashboard import PW, RUN, _user, c  # noqa: F401

pytestmark = pytest.mark.asyncio(loop_scope="session")
A = "/api/v1/admin"


async def _grant(user, role):
    async with AsyncSessionLocal() as db:
        await rbac_service.grant_role(db, uuid.UUID(user["id"]), role)
        await db.commit()


async def test_admin_dashboard(c):  # noqa: F811
    boss = await _user(c, "boss")
    await _grant(boss, "SUPER_ADMIN")
    support = await _user(c, "support")
    await _grant(support, "SUPPORT_AGENT")
    teacher = await _user(c, "adm-teacher", teacher=True)
    student = await _user(c, "adm-student")

    # students see nothing
    for path in ("/stats", "/users", "/roles", "/courses", "/orders"):
        assert (await c.get(A + path, headers=student["h"])).status_code == 403, path

    # stats
    r = await c.get(f"{A}/stats", headers=boss["h"])
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["users_by_role"]["SUPER_ADMIN"] >= 1 and s["users_by_role"]["TEACHER"] >= 1
    assert s["users_total"] >= 4

    # user filters
    r = await c.get(f"{A}/users", headers=boss["h"], params={"search": RUN, "role": "teacher"})
    assert [u["email"] for u in r.json()] == [teacher["email"]]

    # roles: grant + revoke teacher
    r = await c.post(f"{A}/users/{student['id']}/roles", headers=boss["h"], json={"role_code": "TEACHER"})
    assert r.status_code == 200 and "TEACHER" in r.json()["roles"]
    r = await c.delete(f"{A}/users/{student['id']}/roles/TEACHER", headers=boss["h"])
    assert r.status_code == 200 and "TEACHER" not in r.json()["roles"]

    # suspension: not yourself, not someone who outranks you
    assert (await c.patch(f"{A}/users/{boss['id']}/status", headers=boss["h"], json={"status": "SUSPENDED"})).status_code == 409
    assert (await c.patch(f"{A}/users/{boss['id']}/status", headers=support["h"], json={"status": "SUSPENDED"})).status_code == 403
    r = await c.patch(f"{A}/users/{student['id']}/status", headers=support["h"], json={"status": "SUSPENDED"})
    assert r.status_code == 200 and r.json()["status"] == "SUSPENDED"
    # locked out at once, and can't sign in
    assert (await c.get("/api/v1/auth/me", headers=student["h"])).status_code in (401, 403)
    r = await c.post("/api/v1/auth/login", json={"email": student["email"], "password": PW})
    assert r.status_code == 403
    r = await c.get(f"{A}/users", headers=boss["h"], params={"search": RUN, "status": "SUSPENDED"})
    assert [u["email"] for u in r.json()] == [student["email"]]
    r = await c.patch(f"{A}/users/{student['id']}/status", headers=boss["h"], json={"status": "ACTIVE"})
    assert r.status_code == 200
    assert (await c.get("/api/v1/auth/me", headers=student["h"])).status_code == 200

    # all courses, drafts included; admin can publish someone else's course
    r = await c.post("/api/v1/courses", headers=teacher["h"], json={"title": f"Draft {RUN}", "language_code": "en", "slug": f"draft-{RUN}"})
    cid = r.json()["id"]
    r = await c.get(f"{A}/courses", headers=boss["h"], params={"search": RUN, "status": "DRAFT"})
    assert [x["id"] for x in r.json()] == [cid] and r.json()[0]["owner_email"] == teacher["email"]
    r = await c.patch(f"/api/v1/courses/{cid}/status", headers=boss["h"], json={"status": "PUBLISHED"})
    assert r.status_code == 200 and r.json()["status"] == "PUBLISHED"

    # orders list works (may be empty) and support can read it
    assert (await c.get(f"{A}/orders", headers=support["h"])).status_code == 200
