#!/usr/bin/env sh
set -e

# Run uvicorn in background
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &

# Run nginx in foreground (PID 1)
nginx -g 'daemon off;'

#!/usr/bin/env bash
set -e

# run backend+static on port 80
uvicorn backend.app.main:app --host 0.0.0.0 --port 80
