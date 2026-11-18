import os
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ARTIFACTS = Path(os.environ.get("E2E_ARTIFACTS", Path(__file__).parent / "artifacts"))


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def new_page(browser, request):
    """Opens pages that fail the test on any console error or failed API request,
    and saves a screenshot of each when the test fails."""
    pages, problems = [], []

    def make(width=1366, height=900):
        page = browser.new_page(viewport={"width": width, "height": height})
        page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        page.on("console", lambda m: m.type == "error" and problems.append(f"console: {m.text}"))
        allowed = getattr(request.node, "allowed_failure_parts", ())
        page.on("response", lambda r: r.status >= 400 and not any(a in r.url for a in allowed) and problems.append(f"{r.status} {r.url}"))
        pages.append(page)
        return page

    yield make
    failed = getattr(request.node, "rep_call", None) and request.node.rep_call.failed
    if failed:
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        for i, page in enumerate(pages):
            page.screenshot(path=str(ARTIFACTS / f"{request.node.name}-{i}.png"), full_page=True)
    for page in pages:
        page.close()
    # "Failed to load resource" console lines duplicate the response events above, which
    # already skip the 4xx a test expects (request.node.allowed_failure_parts).
    if not failed:
        bad = [p for p in problems if not p.startswith("console: Failed to load resource")]
        assert not bad, "\n".join(bad)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)
