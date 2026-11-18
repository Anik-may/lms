"""API seeding and browser helpers shared by the end-to-end suites."""
import json
import os
import random
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, expect

WEB = os.environ.get("E2E_WEB_URL", "http://localhost:3000")
API = os.environ.get("E2E_API_URL", "http://localhost:8000/api/v1")
ADMIN_EMAIL = os.environ.get("E2E_ADMIN_EMAIL", "anikdas@gmail.com")
ADMIN_PASSWORD = os.environ.get("E2E_ADMIN_PASSWORD", "admin")
PASSWORD = "E2e-pass-123!"
RUN = f"{random.randint(100000, 999999)}"


class ApiError(Exception):
    pass


def call(method: str, path: str, body=None, tok: str | None = None, ok=(200, 201, 204)):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if tok:
        req.add_header("Authorization", f"Bearer {tok}")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        if e.code in ok:
            return None
        raise ApiError(f"{method} {path} -> {e.code} {e.read()[:300]!r}") from None


def login_api(email: str, password: str = PASSWORD) -> str:
    return call("POST", "/auth/login", {"email": email, "password": password})["access_token"]


def new_user(name: str, role: str | None = None) -> dict:
    """Registers a throwaway account (optionally granting a role through the admin API)."""
    email = f"e2e.{name.lower().replace(' ', '.')}.{RUN}.{random.randint(100, 999)}@example.com"
    display = f"{name} {RUN[-3:]}"
    user = call("POST", "/auth/register", {"email": email, "password": PASSWORD, "display_name": display})
    if role:
        admin = login_api(ADMIN_EMAIL, ADMIN_PASSWORD)
        call("POST", f"/admin/users/{user['id']}/roles", {"role_code": role}, admin)
    return {"id": user["id"], "email": email, "name": display, "tok": login_api(email)}


def build_course(teacher: dict, title: str, price: str = "0", publish: bool = True) -> dict:
    """A published course with one lesson of every kind, filled in and published."""
    t = teacher["tok"]
    c = call("POST", "/courses", {"title": title, "slug": f"{title.lower().replace(' ', '-')}-{RUN}-{random.randint(100, 999)}", "language_code": "en"}, t)
    cid = c["id"]
    call("PATCH", f"/courses/{cid}", {"subtitle": "Learn by doing", "description": "## What you'll learn\n\n- Light\n- Composition"}, t)
    sec = call("POST", f"/courses/{cid}/sections", {"title": "Getting started"}, t)["id"]

    def lesson(title, kind, preview=False):
        lid = call("POST", f"/courses/{cid}/sections/{sec}/contents", {"title": title, "content_type": kind, "is_preview": preview}, t)["id"]
        return lid

    ids = {
        "ARTICLE": lesson("Understanding light", "ARTICLE", preview=True),
        "QUIZ": lesson("Light check", "QUIZ"),
        "ASSIGNMENT": lesson("Your first photo walk", "ASSIGNMENT"),
    }
    call("PUT", f"/courses/{cid}/contents/{ids['ARTICLE']}/article", {"body": "# Light\n\nLight is **everything** in photography."}, t)
    call("PUT", f"/courses/{cid}/contents/{ids['QUIZ']}/quiz", {"pass_percentage": 60}, t)
    call("POST", f"/courses/{cid}/contents/{ids['QUIZ']}/quiz/questions", {
        "question_type": "SINGLE_CHOICE", "question_text": "Which hour gives warm soft light?",
        "options": [{"option_text": "Golden hour", "is_correct": True}, {"option_text": "Noon", "is_correct": False}],
    }, t)
    call("PUT", f"/courses/{cid}/contents/{ids['ASSIGNMENT']}/assignment", {"instructions": "Take 10 photos at golden hour."}, t)
    for lid in ids.values():
        call("PATCH", f"/courses/{cid}/sections/{sec}/contents/{lid}/status", {"status": "PUBLISHED"}, t)
    call("PUT", f"/courses/{cid}/price", {"amount": price}, t)
    if publish:
        call("PATCH", f"/courses/{cid}/status", {"status": "PUBLISHED"}, t)
    return {"id": cid, "title": title, "section": sec, "lessons": ids}


def sample_video(tmp: Path) -> Path:
    """A short VP9 WebM. Playwright's Chromium has no H.264 decoder, so MP4 can't be played back."""
    out = tmp / "sample.webm"
    if not out.exists():
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=6:size=640x360:rate=25",
             "-c:v", "libvpx-vp9", "-b:v", "300k", str(out)],
            check=True,
        )
    return out


def sample_png(tmp: Path) -> Path:
    import struct, zlib
    out = tmp / "thumb.png"
    w, h = 320, 180
    raw = b"".join(b"\0" + b"".join(bytes([x * 255 // w, 90, y * 255 // h]) for x in range(w)) for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    out.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
    return out


def sign_in(page: Page, email: str, password: str = PASSWORD) -> None:
    page.goto(f"{WEB}/login")
    page.locator('input[type="email"]').fill(email)
    page.locator('input[type="password"]').fill(password)
    page.locator('form button:not([type="button"])').click()
    page.wait_for_url(lambda u: "/login" not in u, timeout=15000)


def see(page: Page, text: str, **kw) -> None:
    expect(page.get_by_text(text, **kw).first).to_be_visible(timeout=20000)


def tab(page: Page, name: str) -> None:
    page.get_by_role("tab", name=name).or_(page.get_by_role("button", name=name, exact=True)).first.click()


def add_video_lesson(teacher: dict, course: dict, video: Path, title: str = "Welcome") -> str:
    """Uploads a video (multipart) and makes it the course's first, published lesson."""
    import uuid as _uuid
    t, cid, sec = teacher["tok"], course["id"], course["section"]
    boundary = _uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{video.name}\"\r\n"
        f"Content-Type: video/webm\r\n\r\n".encode() + video.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(f"{API}/courses/{cid}/media", method="POST", data=body)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Authorization", f"Bearer {t}")
    with urllib.request.urlopen(req) as r:
        asset = json.loads(r.read())
    lid = call("POST", f"/courses/{cid}/sections/{sec}/contents", {"title": title, "content_type": "VIDEO"}, t)["id"]
    others = [l["id"] for s in call("GET", f"/courses/{cid}/curriculum", tok=t) for l in s["contents"] if l["id"] != lid]
    call("PUT", f"/courses/{cid}/sections/{sec}/contents/order", {"ids": [lid, *others]}, t)
    call("PUT", f"/courses/{cid}/contents/{lid}/video", {"media_asset_id": asset["id"], "duration_seconds": 6}, t)
    call("PATCH", f"/courses/{cid}/sections/{sec}/contents/{lid}/status", {"status": "PUBLISHED"}, t)
    course["lessons"]["VIDEO"] = lid
    return lid
