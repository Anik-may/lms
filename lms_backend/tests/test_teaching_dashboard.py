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


async def test_teacher_manages_students(c):
    T = "/api/v1"
    teacher = await _user(c, "roster-teacher", teacher=True)
    student = await _user(c, "roster-student")
    outsider = await _user(c, "roster-outsider")
    r = await c.post(f"{T}/courses", headers=teacher["h"], json={
        "title": "Roster", "language_code": "en", "slug": f"roster-{RUN}"})
    cid = r.json()["id"]

    # add by email (case-insensitive); unknown, duplicate, staff and outsiders refused
    r = await c.post(f"{T}/courses/{cid}/students", headers=teacher["h"], json={"email": student["email"].upper()})
    assert r.status_code == 201, r.text
    assert r.json()["email"] == student["email"] and r.json()["source"] == "ADMIN"
    assert (await c.post(f"{T}/courses/{cid}/students", headers=teacher["h"], json={"email": student["email"]})).status_code == 409
    assert (await c.post(f"{T}/courses/{cid}/students", headers=teacher["h"], json={"email": "nobody@x.io"})).status_code == 404
    assert (await c.post(f"{T}/courses/{cid}/students", headers=teacher["h"], json={"email": teacher["email"]})).status_code == 409
    assert (await c.post(f"{T}/courses/{cid}/students", headers=outsider["h"], json={"email": outsider["email"]})).status_code == 403
    r = await c.get(f"{T}/courses/{cid}/students", headers=teacher["h"])
    assert [s["email"] for s in r.json()] == [student["email"]]

    # suspend -> restore
    sid = student["id"]
    r = await c.patch(f"{T}/courses/{cid}/students/{sid}", headers=teacher["h"], json={"status": "SUSPENDED"})
    assert r.status_code == 200 and r.json()["status"] == "SUSPENDED"
    assert (await c.patch(f"{T}/courses/{cid}/students/{sid}", headers=teacher["h"], json={"status": "SUSPENDED"})).status_code == 409
    assert (await c.patch(f"{T}/courses/{cid}/students/{sid}", headers=outsider["h"], json={"status": "ACTIVE"})).status_code == 403
    r = await c.patch(f"{T}/courses/{cid}/students/{sid}", headers=teacher["h"], json={"status": "ACTIVE"})
    assert r.status_code == 200 and r.json()["status"] == "ACTIVE"
    assert (await c.patch(f"{T}/courses/{cid}/students/{uuid.uuid4()}", headers=teacher["h"], json={"status": "ACTIVE"})).status_code == 404


async def test_teacher_notifications_and_co_teacher_access(c):
    T = "/api/v1"
    teacher = await _user(c, "notif-teacher", teacher=True)
    co = await _user(c, "notif-co")
    student = await _user(c, "notif-student")
    cid = (await c.post(f"{T}/courses", headers=teacher["h"], json={
        "title": "Notif", "language_code": "en", "slug": f"notif-{RUN}"})).json()["id"]
    await c.patch(f"{T}/courses/{cid}/status", headers=teacher["h"], json={"status": "PUBLISHED"})

    # co-instructor: flagged on /auth/me and notified
    assert (await c.get(f"{T}/auth/me", headers=co["h"])).json()["co_teaches"] is False
    assert (await c.post(f"{T}/courses/{cid}/instructors", headers=teacher["h"], json={"email": co["email"]})).status_code == 201
    assert (await c.get(f"{T}/auth/me", headers=co["h"])).json()["co_teaches"] is True
    types = lambda u: c.get(f"{T}/notifications", headers=u["h"])
    assert "ADDED_AS_INSTRUCTOR" in [n["type"] for n in (await types(co)).json()["items"]]

    # student activity notifies owner and co-instructor, never the student
    await c.post(f"{T}/courses/{cid}/students", headers=teacher["h"], json={"email": student["email"]})
    assert (await c.post(f"{T}/courses/{cid}/discussions", headers=student["h"], json={"title": "Q?", "body": "?"})).status_code == 201
    assert (await c.put(f"{T}/courses/{cid}/reviews/me", headers=student["h"], json={"rating": 4})).status_code == 200
    assert (await c.put(f"{T}/courses/{cid}/reviews/me", headers=student["h"], json={"rating": 5})).status_code == 200
    for u in (teacher, co):
        got = [n["type"] for n in (await types(u)).json()["items"]]
        assert got.count("QUESTION_ASKED") == 1 and got.count("REVIEW_POSTED") == 1, got
    got = [n["type"] for n in (await types(student)).json()["items"]]
    assert "QUESTION_ASKED" not in got and "REVIEW_POSTED" not in got


async def test_review_replies_and_learner_progress(c):
    T = "/api/v1"
    teacher = await _user(c, "reply-teacher", teacher=True)
    student = await _user(c, "reply-student")
    outsider = await _user(c, "reply-outsider", teacher=True)
    cid = (await c.post(f"{T}/courses", headers=teacher["h"], json={
        "title": "Replies", "language_code": "en", "slug": f"replies-{RUN}"})).json()["id"]
    sec = (await c.post(f"{T}/courses/{cid}/sections", headers=teacher["h"], json={"title": "S"})).json()["id"]
    les = (await c.post(f"{T}/courses/{cid}/sections/{sec}/contents", headers=teacher["h"], json={"title": "L", "content_type": "ARTICLE"})).json()["id"]
    await c.put(f"{T}/courses/{cid}/contents/{les}/article", headers=teacher["h"], json={"body": "hi"})
    await c.patch(f"{T}/courses/{cid}/sections/{sec}/contents/{les}/status", headers=teacher["h"], json={"status": "PUBLISHED"})
    await c.patch(f"{T}/courses/{cid}/status", headers=teacher["h"], json={"status": "PUBLISHED"})
    await c.post(f"{T}/courses/{cid}/students", headers=teacher["h"], json={"email": student["email"]})

    # my review: none, then written
    assert (await c.get(f"{T}/courses/{cid}/reviews/me", headers=student["h"])).json() is None
    await c.put(f"{T}/courses/{cid}/reviews/me", headers=student["h"], json={"rating": 4, "body": "Nice"})
    rid = (await c.get(f"{T}/courses/{cid}/reviews/me", headers=student["h"])).json()["id"]

    # reply: only course staff; shown publicly and to the student, who is notified
    assert (await c.put(f"{T}/teaching/reviews/{rid}/reply", headers=outsider["h"], json={"body": "x"})).status_code == 404
    assert (await c.put(f"{T}/teaching/reviews/{rid}/reply", headers=teacher["h"], json={"body": "Thanks!"})).status_code == 204
    assert (await c.put(f"{T}/teaching/reviews/{rid}/reply", headers=teacher["h"], json={"body": "Thanks a lot!"})).status_code == 204
    pub = (await c.get(f"{T}/courses/{cid}/reviews")).json()
    assert pub[0]["instructor_reply"] == "Thanks a lot!"
    assert (await c.get(f"{T}/teaching/reviews", headers=teacher["h"])).json()["reviews"][0]["instructor_reply"] == "Thanks a lot!"
    notes = [n["type"] for n in (await c.get(f"{T}/notifications", headers=student["h"])).json()["items"]]
    assert notes.count("REVIEW_REPLIED") == 1
    assert (await c.delete(f"{T}/teaching/reviews/{rid}/reply", headers=teacher["h"])).status_code == 204
    assert (await c.get(f"{T}/courses/{cid}/reviews")).json()[0]["instructor_reply"] is None

    # per-lesson progress
    assert (await c.get(f"{T}/courses/{cid}/progress/contents", headers=student["h"])).json() == []
    r = await c.put(f"{T}/contents/{les}/progress", headers=student["h"], json={"status": "COMPLETED", "completion_percentage": 100})
    assert r.status_code == 200, r.text
    rows = (await c.get(f"{T}/courses/{cid}/progress/contents", headers=student["h"])).json()
    assert [(x["content_id"], x["status"]) for x in rows] == [(les, "COMPLETED")]
    assert (await c.get(f"{T}/courses/{cid}/progress", headers=student["h"])).json()["completion_percentage"] == 100

    # grading notifies the student
    asg = (await c.post(f"{T}/courses/{cid}/sections/{sec}/contents", headers=teacher["h"], json={"title": "A", "content_type": "ASSIGNMENT"})).json()["id"]
    await c.put(f"{T}/courses/{cid}/contents/{asg}/assignment", headers=teacher["h"], json={"instructions": "Do it"})
    await c.patch(f"{T}/courses/{cid}/sections/{sec}/contents/{asg}/status", headers=teacher["h"], json={"status": "PUBLISHED"})
    sub = await c.post(f"{T}/courses/{cid}/contents/{asg}/assignment/submissions", headers=student["h"], json={"text_submission": "done"})
    assert sub.status_code == 201, sub.text
    r = await c.put(f"{T}/courses/{cid}/submissions/{sub.json()['id']}/grade", headers=teacher["h"], json={"score": 90, "feedback": "Good"})
    assert r.status_code == 200, r.text
    items = (await c.get(f"{T}/notifications", headers=student["h"])).json()["items"]
    graded = [n for n in items if n["type"] == "SUBMISSION_GRADED"]
    assert len(graded) == 1 and graded[0]["data"]["course_id"] == cid and "90/100" in graded[0]["body"]


async def test_payments_cannot_be_faked(c, monkeypatch):
    from app.core.config import settings

    T = "/api/v1"
    teacher = await _user(c, "pay-teacher", teacher=True)
    buyer = await _user(c, "pay-buyer")
    cid = (await c.post(f"{T}/courses", headers=teacher["h"], json={
        "title": "Paid", "language_code": "en", "slug": f"paid-{RUN}"})).json()["id"]
    await c.put(f"{T}/courses/{cid}/price", headers=teacher["h"], json={"amount": "20"})
    await c.patch(f"{T}/courses/{cid}/status", headers=teacher["h"], json={"status": "PUBLISHED"})
    await c.post(f"{T}/cart/items", headers=buyer["h"], json={"course_id": cid})
    oid = (await c.post(f"{T}/checkout", headers=buyer["h"], json={"idempotency_key": f"pay-{RUN}"})).json()["id"]
    pay = lambda provider: c.post(f"{T}/orders/{oid}/pay", headers=buyer["h"], json={"provider": provider, "provider_payment_id": f"x-{RUN}"})

    assert (await pay("stripe")).status_code == 400          # unverifiable provider
    assert (await pay("free")).status_code == 400            # not a free order
    monkeypatch.setattr(settings, "allow_mock_payments", False)
    monkeypatch.setattr(settings, "stripe_secret_key", None)  # no Stripe key: the fake one stands in
    assert (await c.get(f"{T}/payments/config")).json() == {"providers": ["fake_stripe"], "test_mode": True}
    assert (await pay("fake_stripe")).status_code == 400     # cards are charged by the server, not claimed
    assert (await pay("mock")).status_code == 403            # test payments switched off
    assert (await c.get(f"{T}/orders/{oid}", headers=buyer["h"])).json()["status"] == "PENDING"
    monkeypatch.setattr(settings, "allow_mock_payments", True)
    assert (await c.get(f"{T}/payments/config")).json()["test_mode"] is True
    r = await pay("mock")
    assert r.status_code == 200, r.text
    assert (await c.get(f"{T}/orders/{oid}", headers=buyer["h"])).json()["status"] == "PAID"
    # a payment id can't be replayed, and the course can't be bought twice
    assert (await pay("mock")).status_code == 409
    assert (await c.post(f"{T}/cart/items", headers=buyer["h"], json={"course_id": cid})).status_code == 409


async def test_fake_stripe_card_payments(c, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "stripe_secret_key", None)
    T = "/api/v1"
    teacher = await _user(c, "card-teacher", teacher=True)
    buyer = await _user(c, "card-buyer")
    cid = (await c.post(f"{T}/courses", headers=teacher["h"], json={
        "title": "Card", "language_code": "en", "slug": f"card-{RUN}"})).json()["id"]
    await c.put(f"{T}/courses/{cid}/price", headers=teacher["h"], json={"amount": "30"})
    await c.patch(f"{T}/courses/{cid}/status", headers=teacher["h"], json={"status": "PUBLISHED"})
    await c.post(f"{T}/cart/items", headers=buyer["h"], json={"course_id": cid})
    oid = (await c.post(f"{T}/checkout", headers=buyer["h"], json={"idempotency_key": f"card-{RUN}"})).json()["id"]

    def card(number, exp="12/40", cvc="123"):
        m, y = exp.split("/")
        return c.post(f"{T}/orders/{oid}/pay/card", headers=buyer["h"],
                      json={"number": number, "exp_month": int(m), "exp_year": int(y), "cvc": cvc})

    for number, kw, code in [
        ("4242 4242 4242 4241", {}, "incorrect_number"),          # fails the Luhn check
        ("4242 4242 4242 4242", {"exp": "01/20"}, "invalid_expiry"),
        ("4242 4242 4242 4242", {"cvc": "12"}, "invalid_cvc"),
        ("4000 0000 0000 0002", {}, "card_declined"),
        ("4000 0000 0000 9995", {}, "insufficient_funds"),
        ("4111 1111 1111 1111", {}, "live_card_in_test_mode"),    # valid, but not a test card
    ]:
        r = await card(number, **kw)
        assert r.status_code == 402, (number, r.text)
        assert r.headers["x-decline-code"] == code
    order = (await c.get(f"{T}/orders/{oid}", headers=buyer["h"])).json()
    assert order["status"] == "PENDING"
    assert len(order["payments"]) == 6 and {p["status"] for p in order["payments"]} == {"FAILED"}

    r = await card("4242424242424242")
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] == "CAPTURED" and p["card_brand"] == "visa" and p["card_last4"] == "4242"
    assert p["provider_payment_id"].startswith("ch_fake_")
    order = (await c.get(f"{T}/orders/{oid}", headers=buyer["h"])).json()
    assert order["status"] == "PAID"
    assert (await c.get(f"{T}/courses/{cid}/progress/contents", headers=buyer["h"])).status_code == 200
    assert (await card("4242424242424242")).status_code == 409  # already paid


async def test_stripe_checkout(c, monkeypatch):
    """The real Stripe flow, with Stripe itself replaced by an in-memory stand-in."""
    from app.core.config import settings
    from app.services import stripe_gateway as sg

    T = "/api/v1"
    teacher = await _user(c, "stripe-teacher", teacher=True)
    buyer = await _user(c, "stripe-buyer")
    other = await _user(c, "stripe-other")
    cid = (await c.post(f"{T}/courses", headers=teacher["h"], json={
        "title": "Striped", "language_code": "en", "slug": f"striped-{RUN}"})).json()["id"]
    await c.put(f"{T}/courses/{cid}/price", headers=teacher["h"], json={"amount": "25.50"})
    await c.patch(f"{T}/courses/{cid}/status", headers=teacher["h"], json={"status": "PUBLISHED"})
    await c.post(f"{T}/cart/items", headers=buyer["h"], json={"course_id": cid})
    oid = (await c.post(f"{T}/checkout", headers=buyer["h"], json={"idempotency_key": f"stripe-{RUN}"})).json()["id"]
    start = lambda: c.post(f"{T}/orders/{oid}/pay/stripe", headers=buyer["h"])
    confirm = lambda h=buyer["h"]: c.post(f"{T}/orders/{oid}/pay/stripe/confirm", headers=h)
    hook = lambda sid, sig="t=1,v1=x": c.post(f"{T}/payments/stripe/webhook", content=sid, headers={"stripe-signature": sig})

    # not configured: no Stripe route works, and nothing is charged
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    assert (await start()).status_code == 400
    assert (await hook("cs_x")).status_code == 503

    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_x")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_x")
    monkeypatch.setattr(settings, "allow_mock_payments", False)
    assert (await c.get(f"{T}/payments/config")).json() == {"providers": ["stripe"], "test_mode": True}
    assert (await hook("cs_x")).status_code == 400  # a call Stripe did not sign

    sessions, created = {}, []

    async def create_session(**kw):
        s = sg.StripeSession(
            id=f"cs_test_{uuid.uuid4().hex}", url=f"https://checkout.stripe.test/{len(created)}", status="open",
            payment_status="unpaid", order_id=kw["order_id"], currency=kw["currency"].lower(),
            amount_total=sum(sg.to_minor_units(i.amount, kw["currency"]) for i in kw["items"]),
        )
        sessions[s.id] = s
        created.append((s, kw))
        return s

    async def get_session(sid):
        return sessions[sid]

    monkeypatch.setattr(sg, "create_session", create_session)
    monkeypatch.setattr(sg, "get_session", get_session)
    monkeypatch.setattr(sg, "parse_event", lambda payload, sig: ("checkout.session.completed", payload.decode()))

    # with Stripe on, the simulated card form can't be used to skip paying
    r = await c.post(f"{T}/orders/{oid}/pay/card", headers=buyer["h"],
                     json={"number": "4242424242424242", "exp_month": 12, "exp_year": 40, "cvc": "123"})
    assert r.status_code == 400
    assert (await c.post(f"{T}/orders/{oid}/pay/stripe", headers=other["h"])).status_code == 404

    r = await start()
    assert r.status_code == 200, r.text
    first, kw = created[0]
    assert r.json() == {"url": first.url} and first.amount_total == 2550
    assert kw["items"][0].name == "Striped" and kw["customer_email"] == buyer["email"]
    assert kw["success_url"].endswith(f"/checkout?order={oid}&stripe=success")
    assert (await start()).json() == {"url": first.url} and len(created) == 1  # open session is reused

    # coming back without paying changes nothing, and other people can't confirm it
    assert (await confirm()).json()["status"] == "PENDING"
    assert (await confirm(other["h"])).status_code == 404

    # an expired session is closed off and a fresh one opened
    first.status = "expired"
    second = created[1][0] if (await start()).status_code == 200 and len(created) == 2 else None
    assert second is not None
    order = (await confirm()).json()
    assert sorted(p["status"] for p in order["payments"]) == ["CANCELLED", "PENDING"]

    # a "paid" session for the wrong amount does not unlock the course
    second.status, second.payment_status, second.amount_total = "complete", "paid", 100
    assert (await confirm()).json()["status"] == "PENDING"

    # Stripe's webhook reports the real payment
    second.amount_total, second.payment_intent_id = 2550, f"pi_{RUN}"
    second.card_brand, second.card_last4 = "visa", "4242"
    assert (await hook("cs_unknown")).status_code == 200  # someone else's session: ignored
    assert (await hook(second.id)).json() == {"received": True}
    order = (await confirm()).json()
    assert order["status"] == "PAID"
    paid = [p for p in order["payments"] if p["status"] == "CAPTURED"]
    assert len(paid) == 1 and paid[0]["provider"] == "stripe" and paid[0]["provider_payment_id"] == f"pi_{RUN}"
    assert paid[0]["card_brand"] == "visa" and paid[0]["card_last4"] == "4242" and paid[0]["amount"] == 25.5
    assert (await c.get(f"{T}/courses/{cid}/progress/contents", headers=buyer["h"])).status_code == 200

    # repeats (Stripe retries webhooks) don't pay the teacher twice
    assert (await hook(second.id)).status_code == 200
    assert (await start()).status_code == 409
    sold = [n for n in (await c.get(f"{T}/notifications", headers=teacher["h"])).json()["items"] if n["type"] == "COURSE_SOLD"]
    assert len(sold) == 1
