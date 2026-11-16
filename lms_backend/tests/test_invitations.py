"""Admin invitations: invite with a role and preset password, accept by link, then sign in."""

import uuid

import pytest

from app.core.database import AsyncSessionLocal
from app.services import rbac_service
from tests.test_teaching_dashboard import RUN, _user, c  # noqa: F401

pytestmark = pytest.mark.asyncio(loop_scope="session")
A = "/api/v1/admin/invitations"
P = "/api/v1/invitations"


async def _grant(user, role):
    async with AsyncSessionLocal() as db:
        await rbac_service.grant_role(db, uuid.UUID(user["id"]), role)
        await db.commit()


async def test_invitation_flow(c):  # noqa: F811
    boss = await _user(c, "inv-boss")
    await _grant(boss, "SUPER_ADMIN")
    support = await _user(c, "inv-support")
    await _grant(support, "SUPPORT_AGENT")
    student = await _user(c, "inv-student")
    email = f"invitee-{RUN}@test.io"
    body = {"email": email, "role_code": "TEACHER", "password": "first-pass-123", "display_name": "New Teacher"}

    # students can't invite; nobody can invite above their own level
    assert (await c.post(A, json=body, headers=student["h"])).status_code == 403
    r = await c.post(A, json={**body, "role_code": "SUPER_ADMIN"}, headers=support["h"])
    assert r.status_code == 403

    r = await c.post(A, json=body, headers=boss["h"])
    assert r.status_code == 201, r.text
    sent = r.json()
    assert sent["invitation"]["status"] == "PENDING" and sent["invitation"]["invited_by_name"] == "inv-boss"
    token = sent["invite_url"].rsplit("/", 1)[1]

    # duplicates, existing accounts
    assert (await c.post(A, json=body, headers=boss["h"])).status_code == 409
    assert (await c.post(A, json={**body, "email": student["email"]}, headers=boss["h"])).status_code == 409

    # before accepting: can't sign in or self-register
    r = await c.post("/api/v1/auth/login", json={"email": email, "password": "first-pass-123"})
    assert r.status_code == 403 and "invited" in r.json()["detail"]
    r = await c.post("/api/v1/auth/register", json={"email": email, "password": "whatever-123", "display_name": "x"})
    assert r.status_code == 409

    # resend swaps the link
    r = await c.post(f"{A}/{sent['invitation']['id']}/resend", headers=boss["h"])
    assert r.status_code == 200
    assert (await c.get(f"{P}/{token}")).status_code == 404
    token = r.json()["invite_url"].rsplit("/", 1)[1]

    # public view + accept
    r = await c.get(f"{P}/{token}")
    assert r.status_code == 200 and r.json()["role_name"] and r.json()["status"] == "PENDING"
    r = await c.post(f"{P}/{token}/accept")
    assert r.status_code == 200 and r.json()["status"] == "ACCEPTED"
    assert (await c.post(f"{P}/{token}/accept")).status_code == 409

    # signs in with the preset password and has the role
    r = await c.post("/api/v1/auth/login", json={"email": email, "password": "first-pass-123"})
    assert r.status_code == 200, r.text
    me = (await c.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})).json()
    assert {"TEACHER", "STUDENT"} <= set(me["roles"]) and me["display_name"] == "New Teacher"

    listed = (await c.get(f"{A}?status=ACCEPTED", headers=boss["h"])).json()
    assert email in [i["email"] for i in listed]

    # revoke
    other = (await c.post(A, json={**body, "email": f"revoked-{RUN}@test.io"}, headers=boss["h"])).json()
    r = await c.delete(f"{A}/{other['invitation']['id']}", headers=boss["h"])
    assert r.status_code == 200 and r.json()["status"] == "REVOKED"
    t2 = other["invite_url"].rsplit("/", 1)[1]
    assert (await c.post(f"{P}/{t2}/accept")).status_code == 410
