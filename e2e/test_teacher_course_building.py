"""A teacher builds a course from nothing in the UI: details, thumbnail, every lesson type
(with a real video upload), publishing, pricing, and managing students."""
import os

from playwright.sync_api import expect

from helpers import RUN, WEB, new_user, sample_png, sample_video, see, sign_in, tab


def test_teacher_builds_and_runs_a_course(new_page, tmp_path):
    teacher = new_user("Tara Teacher", role="TEACHER")
    student = new_user("Sam Student")
    page = new_page()
    sign_in(page, teacher["email"])
    page.goto(f"{WEB}/teach")
    see(page, "Teacher dashboard")

    # create
    page.get_by_role("link", name="Courses", exact=True).first.click()
    title = f"Photography {RUN}"
    page.get_by_placeholder("e.g. Python for beginners").fill(title)
    page.get_by_role("button", name="Create").click()
    page.wait_for_url("**/teach/courses/*", timeout=15000)
    expect(page.get_by_role("heading", name=title)).to_be_visible(timeout=15000)

    # details + thumbnail
    tab(page, "Details")
    page.get_by_label("Subtitle").fill("Shoot great photos with any camera")
    page.get_by_label("Description").fill("Composition, light and editing.")
    page.get_by_label("Level").select_option("BEGINNER")
    page.get_by_role("button", name="Save details").click()
    see(page, "Details saved")
    page.locator('input[type="file"][accept="image/*"]').set_input_files(str(sample_png(tmp_path)))
    see(page, "Thumbnail updated")
    thumb = page.locator("main img").first
    expect(thumb).to_be_visible()
    page.wait_for_function("(img) => img.complete && img.naturalWidth > 0", arg=thumb.element_handle(), timeout=15000)

    # curriculum
    tab(page, "Curriculum")
    page.get_by_placeholder("New section title").fill("Getting started")
    page.get_by_role("button", name="Add section").click()

    def add_lesson(name, kind):
        page.get_by_placeholder("New lesson title").fill(name)
        page.get_by_label("Lesson type").select_option(kind)
        page.get_by_role("button", name="Add lesson").click()
        expect(page.get_by_label("Lesson title")).to_have_value(name, timeout=10000)

    def collapse(name):
        page.get_by_role("button", name=name, exact=True).click()

    add_lesson("Welcome", "VIDEO")
    mp4 = os.environ.get("E2E_VIDEO")  # optionally also upload a real MP4 (it can't play in this browser)
    if mp4:
        page.locator('input[type="file"][accept="video/*"]').set_input_files(mp4)
        see(page, "Video uploaded and attached")
        expect(page.get_by_text("video/mp4")).to_be_visible(timeout=15000)
    page.locator('input[type="file"][accept="video/*"]').set_input_files(str(sample_video(tmp_path)))
    see(page, "Video uploaded and attached")
    expect(page.get_by_text("video/webm")).to_be_visible(timeout=15000)
    page.wait_for_function("() => document.querySelector('video')?.readyState >= 1", timeout=30000)
    page.get_by_label("Free preview").click()
    expect(page.get_by_label("Free preview")).to_be_checked(timeout=10000)
    collapse("Welcome")

    add_lesson("Understanding light", "ARTICLE")
    page.get_by_label("Article").fill("# Light\n\nLight is **everything**.")
    page.get_by_role("button", name="Save article").click()
    see(page, "Article saved")
    collapse("Understanding light")

    add_lesson("Light check", "QUIZ")
    page.get_by_label("Question", exact=True).fill("Which hour gives warm soft light?")
    page.get_by_placeholder("Answer 1").fill("Golden hour")
    page.get_by_placeholder("Answer 2").fill("Noon")
    page.get_by_role("button", name="Add question").click()
    see(page, "Question added")
    page.get_by_label("Question type").select_option("SHORT_ANSWER")
    page.get_by_label("Question", exact=True).fill("What does ISO control?")
    page.get_by_label("Accepted answers").fill("sensitivity")
    page.get_by_role("button", name="Add question").click()
    see(page, "2 questions")
    collapse("Light check")

    add_lesson("Photo walk", "ASSIGNMENT")
    page.get_by_label("Instructions").fill("Take 10 photos at golden hour.")
    page.get_by_role("button", name="Save assignment").click()
    see(page, "Assignment saved")
    collapse("Photo walk")

    while page.get_by_role("button", name="Publish", exact=True).count():
        n = page.get_by_role("button", name="Publish", exact=True).count()
        page.get_by_role("button", name="Publish", exact=True).first.click()
        expect(page.get_by_role("button", name="Publish", exact=True)).to_have_count(n - 1, timeout=10000)
    page.get_by_label("Move Photo walk up").click()
    expect(page.locator("main li button[aria-expanded]").nth(2)).to_contain_text("Photo walk", timeout=10000)

    # price + publish
    tab(page, "Pricing & categories")
    page.get_by_label("Price (USD)").fill("0")
    page.get_by_role("button", name="Save price").click()
    see(page, "Price updated")
    page.get_by_label("Status").select_option("PUBLISHED")
    see(page, "Status set to published")

    # students
    tab(page, "Students")
    page.get_by_placeholder("student@example.com").fill(student["email"])
    page.get_by_role("button", name="Enroll").click()
    see(page, "Student enrolled")
    see(page, student["email"])
    page.get_by_role("button", name="Suspend").click()
    see(page, "no longer has access")
    page.get_by_role("button", name="Restore").click()
    see(page, "can access the course again")
    page.get_by_label("Search students").fill("zzz-nobody")
    see(page, "No students match.")
    expect(page.locator("main").get_by_text("1 active")).to_be_visible()

    # phone width: no sideways scrolling
    page.set_viewport_size({"width": 400, "height": 850})
    tab(page, "Curriculum")
    assert page.evaluate("() => document.documentElement.scrollWidth") <= 400
