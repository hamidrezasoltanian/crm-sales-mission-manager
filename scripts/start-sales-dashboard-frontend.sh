#!/usr/bin/env bash
# Ensures the Sales Analysis Dashboard frontend (Vite dev server) is running.

set -euo pipefail

DASHBOARD_FRONTEND_DIR="/home/hamidreza/App/Sales-Analysis-Dashboard-main/Sales-Analysis-Dashboard-main"
LOG_FILE="/tmp/sales-dashboard-frontend.log"
PORT="${SALES_DASHBOARD_FRONTEND_PORT:-5000}"

if [[ ! -d "$DASHBOARD_FRONTEND_DIR" ]]; then
  echo "Sales dashboard frontend directory not found: $DASHBOARD_FRONTEND_DIR" >&2
  exit 1
fi

echo "Stopping any existing Sales Dashboard frontend processes..."
pkill -f "vite --port $PORT" 2>/dev/null || true
pkill -f "$DASHBOARD_FRONTEND_DIR/node_modules/.bin/vite" 2>/dev/null || true

sleep 2

echo "Starting Sales Dashboard frontend on port $PORT..."
(
  cd "$DASHBOARD_FRONTEND_DIR"
  PORT="$PORT" npm run dev >"$LOG_FILE" 2>&1 &
)

echo "Sales Dashboard frontend started. Logs: $LOG_FILE"


