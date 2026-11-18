#!/usr/bin/env bash
# Runs the browser tests against the running stack. Extra args go to pytest.
set -euo pipefail
cd "$(dirname "$0")"
uv run -q -p 3.12 --with playwright==1.49.1 --with pytest==8.3.4 playwright install chromium >/dev/null
exec uv run -q -p 3.12 --with playwright==1.49.1 --with pytest==8.3.4 pytest -p no:cacheprovider "$@"
