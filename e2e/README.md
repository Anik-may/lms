# End-to-end tests

Real-browser tests (Playwright + Chromium) of the running app. Each test signs up its own
throwaway teacher and students through the API, so they don't depend on existing data
and can run against a dev database at any time.

| Suite | Covers |
|---|---|
| `test_teacher_course_building.py` | Teacher builds a course in the UI: details, thumbnail, video/article/quiz/assignment lessons, publishing, reordering, price, enrolling and suspending students, phone width |
| `test_teacher_pages.py` | Notifications, Q&A, grading and re-grading, review replies, earnings and payouts, profile, tags, co-instructor access |
| `test_student.py` | Public course page, signed-out previews, test-mode checkout, the course player through to the certificate, replies reaching the student |

## Run

The stack must be up (`docker compose up --build` from the repo root) with
`ALLOW_MOCK_PAYMENTS=true` (set in the root `.env` for local development).

```bash
./e2e/run.sh            # all suites
./e2e/run.sh -k student # one suite
```

Needs `uv` and `ffmpeg` (used to generate a small test video). The first run downloads
Chromium. Screenshots of failing pages land in `e2e/artifacts/`.

Settings (environment variables): `E2E_WEB_URL`, `E2E_API_URL`, `E2E_ADMIN_EMAIL`,
`E2E_ADMIN_PASSWORD` (an admin is needed to grant the Teacher role), and `E2E_VIDEO`
(optional path to an MP4 to upload as well; Playwright's Chromium can't play H.264, so
playback is checked with the generated WebM).
