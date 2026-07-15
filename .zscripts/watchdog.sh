#!/bin/bash
# Watchdog script that keeps the dev server alive.
# If the server dies (e.g. OOM), it restarts it.

LOG_FILE="/home/z/my-project/.zscripts/dev.log"
PID_FILE="/home/z/my-project/.zscripts/dev.pid"
PROJECT_DIR="/home/z/my-project"

cd "$PROJECT_DIR"

while true; do
  # Check if server is alive
  if curl -s --connect-timeout 2 --max-time 5 "http://localhost:3000" >/dev/null 2>&1; then
    # Server is healthy, sleep and check again
    sleep 10
    continue
  fi

  echo "[$(date '+%H:%M:%S')] Server not responding, (re)starting..."
  
  # Kill any zombie processes
  pkill -9 -f "next dev" 2>/dev/null || true
  pkill -9 -f "next-server" 2>/dev/null || true
  sleep 2

  # Start dev server with setsid to fully detach
  setsid bun run dev > "$LOG_FILE" 2>&1 < /dev/null &
  disown
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PID_FILE"
  
  # Wait for server to be ready
  for i in $(seq 1 30); do
    if curl -s --connect-timeout 2 --max-time 5 "http://localhost:3000" >/dev/null 2>&1; then
      echo "[$(date '+%H:%M:%S')] Server is ready (attempt $i)"
      break
    fi
    sleep 2
  done
  
  # Sleep before next check
  sleep 15
done
