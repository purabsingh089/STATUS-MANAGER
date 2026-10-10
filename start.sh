#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ ! -d node_modules ]; then
  npm install
fi

# Start backend API in background
npm run dev -w backend &
BACKEND_PID=$!

# Start frontend (exposed preview port)
npm run dev -w frontend

trap "kill $BACKEND_PID" EXIT
