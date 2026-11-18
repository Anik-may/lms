"""Students: the public course page, free previews while signed out, buying a paid course,
and taking a course end to end in the player, through to the certificate and replies."""
from playwright.sync_api import expect

from helpers import RUN, WEB, add_video_lesson, build_course, call, new_user, sample_video, see, sign_in, tab


def sidebar_done(page, n, total):
    expect(page.locator("aside").get_by_text(f"{n}/{total} done")).to_be_visible(timeout=20000)


def test_public_page_preview_and_checkout(new_page, request):
    request.node.allowed_failure_parts = ("/pay/card",)  # the declined card is a 402 on purpose
    teacher = new_user("Tara Teacher", role="TEACHER")
    buyer = new_user("Pat Payer")
    course = build_course(teacher, f"Lightroom {RUN}", price="49")
    call("PUT", f"/courses/{course['id']}/price", {"amount": "49", "list_price": "99"}, teacher["tok"])

    # signed out: public page, then a free preview lesson
    page = new_page()
    page.goto(f"{WEB}/courses/{course['id']}")
    title = page.get_by_role("heading", name=f"Lightroom {RUN}", level=1)
    expect(title).to_be_visible(timeout=15000)
    expect(title).to_have_css("color", "rgb(255, 255, 255)")  # readable on the dark hero
    see(page, "$49.00")
    see(page, "$99.00")
    see(page, "What you'll learn")
    page.get_by_role("link", name="Understanding light").click()
    expect(page.get_by_role("heading", name="Understanding light", level=2)).to_be_visible(timeout=15000)
    see(page, "Light is")
    see(page, "You're not enrolled")
    page.locator("aside").get_by_role("button", name="Light check").click()
    see(page, "Enroll to open this lesson")

    # signed in: buy it
    sign_in(page, buyer["email"])
    page.goto(f"{WEB}/courses/{course['id']}")
    page.get_by_role("link", name="Buy now").click()
    page.wait_for_url("**/checkout**", timeout=15000)
    see(page, f"Lightroom {RUN}")
    see(page, "Test mode")
    # a declined card first (fake Stripe answers 402), typed in raw and formatted as you type
    page.get_by_label("Name on card").fill("Pat Payer")
    page.get_by_label("Card number").fill("4000000000000002")
    expect(page.get_by_label("Card number")).to_have_value("4000 0000 0000 0002")
    page.get_by_label("Expiry").fill("1240")
    expect(page.get_by_label("Expiry")).to_have_value("12 / 40")
    page.get_by_label("CVC").fill("123")
    page.get_by_role("button", name="Pay $49.00").click()
    see(page, "Your card was declined.")
    # then the success test card, picked from the list
    page.get_by_role("button", name="4242 4242 4242 4242").click()
    page.get_by_role("button", name="Pay $49.00").click()
    see(page, "You're in!")
    see(page, "Visa •••• 4242")
    page.get_by_role("link", name=f"Start “Lightroom {RUN}”").click()
    page.wait_for_url(f"**/learn/{course['id']}**", timeout=15000)
    expect(page.locator("aside").get_by_text("0/3 done")).to_be_visible(timeout=20000)

    # the order shows in their account; the course page now offers "Start learning"
    page.goto(f"{WEB}/profile/orders")
    see(page, "$49.00")
    see(page, "Visa •••• 4242")
    page.goto(f"{WEB}/courses/{course['id']}")
    expect(page.get_by_role("link", name="Start learning")).to_be_visible(timeout=15000)
    # and the teacher earned from it
    earnings = call("GET", "/teaching/earnings", tok=teacher["tok"])
    assert earnings["courses"][0]["sales_count"] == 1


def test_student_takes_a_course_to_the_certificate(new_page, tmp_path):
    teacher = new_user("Tara Teacher", role="TEACHER")
    student = new_user("Lea Learner")
    course = build_course(teacher, f"Photo Basics {RUN}")
    add_video_lesson(teacher, course, sample_video(tmp_path))
    cid = course["id"]

    page = new_page()
    sign_in(page, student["email"])
    # free enroll from the catalog card
    page.goto(f"{WEB}/courses?q=Photo+Basics+{RUN}")
    page.get_by_role("button", name="Enroll for free").click()
    page.wait_for_url(f"**/learn/{cid}**", timeout=15000)
    expect(page.get_by_role("heading", name="Welcome", level=2)).to_be_visible(timeout=15000)
    sidebar_done(page, 0, 4)

    # video completes at 90% and does NOT jump ahead to the next lesson
    page.wait_for_function("() => document.querySelector('video')?.readyState >= 1", timeout=30000)
    page.evaluate("async () => { const v = document.querySelector('video'); v.muted = true; await v.play(); v.currentTime = v.duration * 0.95; }")
    sidebar_done(page, 1, 4)
    expect(page.get_by_role("heading", name="Welcome", level=2)).to_be_visible()

    page.get_by_role("button", name="Next lesson").click()
    expect(page.locator("article strong", has_text="everything")).to_be_visible(timeout=15000)
    page.get_by_role("button", name="Mark as complete").click()
    sidebar_done(page, 2, 4)

    page.get_by_role("button", name="Next lesson").click()
    page.get_by_label("Golden hour").check()
    page.get_by_role("button", name="Submit answers").click()
    see(page, "Passed")
    sidebar_done(page, 3, 4)

    page.get_by_role("button", name="Next lesson").click()
    see(page, "Take 10 photos at golden hour")
    page.get_by_label("Your answer").fill(f"My album {RUN}")
    page.get_by_role("button", name="Submit", exact=True).click()
    see(page, "Your instructor will grade it")
    sidebar_done(page, 4, 4)

    see(page, "You finished the course!")
    page.get_by_role("button", name="Get certificate").click()
    page.wait_for_url("**/profile/certificates", timeout=15000)
    see(page, f"Photo Basics {RUN}")

    # question + review
    page.goto(f"{WEB}/learn/{cid}")
    tab(page, "Q&A")
    page.get_by_role("button", name="Ask a question").click()
    page.get_by_label("Question", exact=True).fill(f"Best lens? {RUN}")
    page.get_by_label("Details").fill("Budget $300.")
    page.get_by_role("button", name="Post question").click()
    see(page, "Budget $300.")
    tab(page, "Your review")
    page.get_by_label("5 stars").click()
    page.get_by_label("Your review (optional)").fill(f"Loved it {RUN}")
    page.get_by_role("button", name="Post review").click()
    see(page, "Thanks for your review")

    # teacher responds (through the API; the teacher UI is covered in test_teacher_pages)
    t = teacher["tok"]
    review = call("GET", "/teaching/reviews", tok=t)["reviews"][0]
    call("PUT", f"/teaching/reviews/{review['id']}/reply", {"body": "Thank you Lea!"}, t)
    thread = call("GET", "/teaching/questions?unanswered=true", tok=t)[0]
    call("POST", f"/teaching/questions/{thread['thread_id']}/replies", {"body": "A 35mm prime."}, t)
    sub = call("GET", "/teaching/submissions?status=SUBMITTED", tok=t)[0]
    call("PUT", f"/courses/{cid}/submissions/{sub['id']}/grade", {"score": 95, "feedback": "Lovely."}, t)

    # student sees all of it, starting from the notification
    page.goto(f"{WEB}/profile/notifications")
    see(page, "The instructor replied to your review")
    see(page, "An instructor replied to your question")
    page.get_by_role("link", name="Your assignment was graded: Your first photo walk").click()
    page.wait_for_url(f"**/learn/{cid}**", timeout=15000)
    page.goto(f"{WEB}/learn/{cid}?lesson={course['lessons']['ASSIGNMENT']}")
    see(page, "95 / 100")
    see(page, "Lovely.")
    tab(page, "Your review")
    see(page, "Thank you Lea!")
    tab(page, "Q&A")
    page.get_by_role("button", name=f"Best lens? {RUN}").click()
    see(page, "A 35mm prime.")

    # the public course page shows the review with the instructor's response
    page.goto(f"{WEB}/courses/{cid}")
    see(page, f"Loved it {RUN}")
    see(page, "Response from")
    see(page, "Thank you Lea!")

    # phone width
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{WEB}/learn/{cid}")
    page.get_by_role("button", name="Course content").click()
    see(page, "Section 1")
    assert page.evaluate("() => document.documentElement.scrollWidth") <= 390
