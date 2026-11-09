#!/bin/sh
set -e

# Apply migrations before serving; set SKIP_MIGRATIONS=1 when running one-off commands
# (e.g. `python -m app.cli ...`) or when another replica already handles them.
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
    alembic upgrade head
fi

exec "$@"
