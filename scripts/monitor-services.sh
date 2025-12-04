#!/usr/bin/env bash
# Continuous watchdog to make sure all critical services stay online.
# It checks every minute (configurable) and restarts any unhealthy service.

set -euo pipefail

APP_DIR="/home/hamidreza/App/sales-mission-manager"
LOG_FILE="$APP_DIR/scripts/monitor.log"
CHECK_INTERVAL="${CHECK_INTERVAL_SECONDS:-60}"
RECHECK_DELAY="${RECHECK_DELAY_SECONDS:-8}"
RUN_MODE="loop"
LOCK_FILE="/tmp/smm-monitor.lock"

SERVICES=(
  "name=mission-backend;type=http;target=http://127.0.0.1:2001/api/health;start=$APP_DIR/scripts/start-backend.sh"
  "name=mission-frontend;type=http;target=http://127.0.0.1:2000;start=$APP_DIR/scripts/start-frontend.sh"
  "name=sales-dashboard-backend;type=http;target=http://127.0.0.1:3001/health;start=$APP_DIR/scripts/start-sales-dashboard-backend.sh"
  "name=sales-dashboard-frontend;type=http;target=http://127.0.0.1:5000;start=$APP_DIR/scripts/start-sales-dashboard-frontend.sh"
)

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

if [[ "${1:-}" == "--once" ]]; then
  RUN_MODE="once"
fi

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Another monitor instance is already running." | tee -a "$LOG_FILE"
  exit 0
fi

log() {
  local message="$1"
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" | tee -a "$LOG_FILE"
}

check_http() {
  local url="$1"
  curl -fsS --max-time 10 "$url" >/dev/null 2>&1
}

check_service() {
  local type="$1"
  local target="$2"

  case "$type" in
    http)
      check_http "$target"
      ;;
    *)
      log "⚠️  Unknown check type '$type' for target '$target'."
      return 1
      ;;
  esac
}

start_service() {
  local name="$1"
  local script_path="$2"

  if [[ ! -x "$script_path" ]]; then
    log "❌ Cannot restart $name. Start script missing or not executable: $script_path"
    return 1
  fi

  log "🔄 Restarting $name using $script_path..."
  bash "$script_path" >>"$LOG_FILE" 2>&1 || {
    log "❌ Restart script failed for $name."
    return 1
  }

  return 0
}

get_field() {
  local config="$1"
  local key="$2"

  echo "$config" | tr ';' '\n' | grep -E "^${key}=" | head -n1 | cut -d'=' -f2-
}

monitor_service() {
  local config="$1"
  local name target type start_script

  name="$(get_field "$config" "name")"
  type="$(get_field "$config" "type")"
  target="$(get_field "$config" "target")"
  start_script="$(get_field "$config" "start")"

  if [[ -z "$name" || -z "$type" || -z "$target" || -z "$start_script" ]]; then
    log "⚠️  Invalid service config: $config"
    return
  fi

  if check_service "$type" "$target"; then
    log "✅ $name is healthy."
    return
  fi

  log "❌ $name health check failed (target: $target)."
  if start_service "$name" "$start_script"; then
    log "⏳ Waiting $RECHECK_DELAY seconds before re-checking $name..."
    sleep "$RECHECK_DELAY"
    if check_service "$type" "$target"; then
      log "✅ $name recovered successfully."
    else
      log "🚨 $name is still down after restart attempt."
    fi
  fi
}

monitor_once() {
  log "Running health checks..."
  for svc in "${SERVICES[@]}"; do
    monitor_service "$svc"
  done
}

if [[ "$RUN_MODE" == "once" ]]; then
  monitor_once
  log "Single-pass mode requested. Exiting monitor."
  exit 0
fi

while true; do
  monitor_once
  sleep "$CHECK_INTERVAL"
done

