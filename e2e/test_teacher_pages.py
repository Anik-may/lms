"""The teacher's day-to-day pages, driven by real student activity: grading, Q&A, review
replies, earnings and payouts, notifications, profile, tags, and co-instructors."""
from playwright.sync_api import expect

from helpers import RUN, WEB, build_course, call, new_user, see, sign_in, tab


def test_teacher_handles_student_activity(new_page, request):
    # A pending verification request may already exist; the page shows that 409 to the user.
    request.node.allowed_failure_parts = ("/teaching/verification",)
    teacher = new_user("Tara Teacher", role="TEACHER")
    student = new_user("Nia Student")
    co = new_user("Cora Co")
    free = build_course(teacher, f"Free Photo {RUN}")
    paid = build_course(teacher, f"Paid Photo {RUN}", price="49")
    s = student["tok"]

    # student activity
    call("POST", f"/courses/{free['id']}/students", {"email": student["email"]}, teacher["tok"])
    call("POST", f"/courses/{free['id']}/contents/{free['lessons']['ASSIGNMENT']}/assignment/submissions", {"text_submission": f"Album {RUN}"}, s)
    q_title = f"Which ISO at sunset? {RUN}"
    call("POST", f"/courses/{free['id']}/discussions", {"title": q_title, "body": "Grainy after sunset."}, s)
    call("PUT", f"/courses/{free['id']}/reviews/me", {"rating": 4, "body": f"Clear and practical {RUN}"}, s)
    call("POST", "/cart/items", {"course_id": paid["id"]}, s)
    order = call("POST", "/checkout", {"idempotency_key": f"e2e-{RUN}"}, s)
    call("POST", f"/orders/{order['id']}/pay", {"provider": "mock", "provider_payment_id": f"e2e-{RUN}"}, s)

    page = new_page()
    sign_in(page, teacher["email"])
    page.goto(f"{WEB}/teach")
    expect(page.get_by_text("Waiting to grade").locator("..").locator("..")).to_contain_text("1", timeout=15000)

    # notifications: one of each, linked
    page.get_by_role("link", name="Notifications", exact=True).first.click()
    for text in ["New submission: Your first photo walk", f"New question from {student['name']}",
                 f"New 4-star review from {student['name']}", f"New sale: Paid Photo {RUN}"]:
        see(page, text)
    page.get_by_role("link", name=f"New question from {student['name']}").click()
    page.wait_for_url("**/teach/questions", timeout=10000)

    # Q&A
    page.get_by_role("button", name=q_title).click()
    page.get_by_label("Your reply").fill("Raise ISO and use a tripod.")
    page.get_by_role("button", name="Reply", exact=True).click()
    see(page, "Instructor", exact=True)
    page.get_by_role("button", name="Pin").click()
    expect(page.get_by_role("button", name="Unpin")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Mark resolved").click()
    expect(page.get_by_role("button", name="Reopen")).to_be_visible(timeout=10000)

    # grading + regrading
    page.get_by_role("link", name="Submissions", exact=True).first.click()
    card = page.locator("section").filter(has_text=f"Album {RUN}")
    card.get_by_placeholder("0–100").fill("85")
    card.get_by_placeholder("What went well").fill("Great backlight.")
    card.get_by_role("button", name="Submit grade").click()
    expect(card).to_have_count(0, timeout=15000)
    tab(page, "Graded")
    card = page.locator("section").filter(has_text=f"Album {RUN}")
    expect(card.get_by_text("85 / 100")).to_be_visible(timeout=15000)
    card.get_by_role("button", name="Change grade").click()
    card.get_by_placeholder("0–100").fill("92")
    card.get_by_role("button", name="Save grade").click()
    expect(card.get_by_text("92 / 100")).to_be_visible(timeout=15000)

    # review reply
    page.get_by_role("link", name="Reviews", exact=True).first.click()
    item = page.locator("li").filter(has_text=f"Clear and practical {RUN}")
    item.get_by_role("button", name="Reply publicly").click()
    item.get_by_label(f"Reply to {student['name']}").fill("Thanks Nia!")
    item.get_by_role("button", name="Post reply").click()
    expect(item.get_by_text("Your public reply")).to_be_visible(timeout=15000)
    page.get_by_role("button", name="3").first.click()
    expect(page.get_by_text(f"Clear and practical {RUN}")).to_have_count(0, timeout=10000)

    # earnings + payout
    page.get_by_role("link", name="Earnings", exact=True).first.click()
    see(page, f"Paid Photo {RUN}")
    page.get_by_label("Amount").fill("10")
    page.get_by_role("button", name="Request payout").click()
    see(page, "Payout requested")

    # profile + verification
    page.get_by_role("link", name="Profile", exact=True).first.click()
    page.get_by_label("Professional title").fill("Landscape photographer")
    page.get_by_role("button", name="Save profile").click()
    see(page, "Instructor profile saved")
    page.get_by_label("Details").fill("https://example.com/portfolio")
    page.get_by_role("button", name="Request").click()
    see(page, "Request sent")
    page.reload()
    expect(page.get_by_label("Professional title")).to_have_value("Landscape photographer", timeout=15000)

    # tags + co-instructor
    page.goto(f"{WEB}/teach/courses/{paid['id']}")
    tab(page, "Pricing & categories")
    expect(page.get_by_label("Price (USD)")).to_have_value("49", timeout=15000)
    page.get_by_placeholder("Add a new tag").fill(f"e2e{RUN}")
    page.get_by_role("button", name="Add", exact=True).click()
    page.get_by_role("button", name="Save", exact=True).click()
    see(page, "Categories and tags saved")
    tab(page, "Instructors")
    page.get_by_placeholder("Co-instructor's email").fill(co["email"])
    page.get_by_role("button", name="Add", exact=True).click()
    see(page, "Instructor added")

    # the co-instructor (no Teacher role) can work on the course but not price, staff or new courses
    cp = new_page()
    sign_in(cp, co["email"])
    cp.goto(f"{WEB}/teach")
    see(cp, "Teacher dashboard")
    expect(cp.get_by_role("link", name="New course")).to_have_count(0)
    cp.get_by_role("link", name="Courses", exact=True).first.click()
    expect(cp.get_by_text("Create a course")).to_have_count(0)
    cp.get_by_role("link", name=f"Paid Photo {RUN}").first.click()
    tab(cp, "Pricing & categories")
    expect(cp.get_by_label("Price (USD)")).to_be_disabled(timeout=15000)
    tab(cp, "Instructors")
    expect(cp.get_by_placeholder("Co-instructor's email")).to_have_count(0)
    cp.get_by_role("link", name="Notifications", exact=True).first.click()
    see(cp, f"You're now teaching Paid Photo {RUN}")
