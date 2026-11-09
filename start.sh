#!/bin/sh
cd "$(dirname "$0")" || exit 1
docker compose up --build -d "$@" || exit 1
echo "Web: http://localhost:3000   API docs: http://localhost:8000/docs"
