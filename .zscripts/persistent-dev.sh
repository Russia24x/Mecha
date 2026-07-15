#!/bin/bash
# Persistent dev server runner - restarts server if it dies
# This script runs in foreground and keeps the server alive

LOG_FILE="/home/z/my-project/.zscripts/dev.log"
PID_FILE="/home/z/my-project/.zscripts/dev.pid"
PROJECT_DIR="/home/z/my-project"

cd "$PROJECT_DIR"

# Kill any existing dev servers
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
sleep 2

while true; do
  echo "[$(date '+%H:%M:%S')] Starting dev server..."
  
  # Start dev server
  ./node_modules/.bin/next dev -p 3000 > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PID_FILE"
  
  # Wait for server process to exit
  wait $SERVER_PID
  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] Server exited with code $EXIT_CODE, restarting in 3s..."
  
  # Cleanup
  pkill -9 -f "next dev" 2>/dev/null || true
  pkill -9 -f "next-server" 2>/dev/null || true
  
  sleep 3
done
