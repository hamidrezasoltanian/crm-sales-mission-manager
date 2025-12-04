#!/usr/bin/env bash
# Ensures the Sales Analysis Dashboard backend (port 3001) is running.

set -euo pipefail

DASHBOARD_BACKEND_DIR="/home/hamidreza/App/Sales-Analysis-Dashboard-main/backend"
LOG_FILE="/tmp/sales-dashboard-backend.log"
PORT="${SALES_DASHBOARD_BACKEND_PORT:-3001}"

if [[ ! -d "$DASHBOARD_BACKEND_DIR" ]]; then
  echo "Sales dashboard backend directory not found: $DASHBOARD_BACKEND_DIR" >&2
  exit 1
fi

echo "Stopping any existing Sales Dashboard backend processes..."
pkill -f "$DASHBOARD_BACKEND_DIR/server.js" 2>/dev/null || true
pkill -f "sales-dashboard-backend@1.0.0 start" 2>/dev/null || true

sleep 2

echo "Starting Sales Dashboard backend on port $PORT..."
(
  cd "$DASHBOARD_BACKEND_DIR"
  PORT="$PORT" npm start >"$LOG_FILE" 2>&1 &
)

echo "Sales Dashboard backend started. Logs: $LOG_FILE"


