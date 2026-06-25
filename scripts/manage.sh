#!/usr/bin/env bash
# ── Agent Explorer Service Manager ────────────────────────────────────────────
# Usage:
#   ./scripts/manage.sh status    # health check all services
#   ./scripts/manage.sh start     # start all services
#   ./scripts/manage.sh stop      # stop all services
#   ./scripts/manage.sh restart   # restart all services
#   ./scripts/manage.sh deploy    # rebuild + restart (full redeploy)
#   ./scripts/manage.sh logs      # tail all logs
#   ./scripts/manage.sh logs:app  # tail Agent Explorer log
#   ./scripts/manage.sh logs:os   # tail EverOS log

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PLIST="$HOME/Library/LaunchAgents/agent.explorer.plist"
OS_PLIST="$HOME/Library/LaunchAgents/ai.evermind.everos.plist"
APP_URL="http://127.0.0.1:3001"
OS_URL="http://127.0.0.1:8000"
APP_LOG="/tmp/agent-explorer.log"
OS_LOG="/tmp/everos.log"

# ── Helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }

check_url() {
  local url=$1 label=$2
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "$url" 2>/dev/null)
  if [[ "$code" == "200" ]]; then
    ok "$label is UP ($url)"
  else
    err "$label is DOWN ($url) — HTTP $code"
    return 1
  fi
}

# ── Commands ──────────────────────────────────────────────────────────────────
status() {
  echo "── Service Status ─────────────────────────────────────"
  check_url "$APP_URL"      "Agent Explorer" || true
  check_url "$OS_URL/health" "EverOS API"    || true

  echo ""
  echo "── launchd ────────────────────────────────────────────"
  launchctl list | grep -E "agent\.explorer|evermind\.everos" 2>/dev/null || warn "No matching launchd services found"

  echo ""
  echo "── Recent errors ──────────────────────────────────────"
  grep -i "error\|ERROR\|Error" "$APP_LOG" 2>/dev/null | tail -3 || true
  grep -i "error\|ERROR\|Error" "$OS_LOG"  2>/dev/null | tail -3 || true
}

start() {
  echo "Starting services…"
  launchctl load "$OS_PLIST"  2>/dev/null || warn "EverOS plist already loaded"
  launchctl load "$APP_PLIST" 2>/dev/null || warn "App plist already loaded"
  sleep 8
  check_url "$OS_URL/health" "EverOS"         || true
  check_url "$APP_URL"       "Agent Explorer" || true
}

stop() {
  echo "Stopping services…"
  launchctl unload "$APP_PLIST" 2>/dev/null || true
  launchctl unload "$OS_PLIST"  2>/dev/null || true
  ok "Services stopped"
}

restart() {
  stop
  sleep 2
  start
}

deploy() {
  echo "── Building production bundle ──────────────────────────"
  cd "$DIR"
  npm run build

  echo "── Syncing static assets ───────────────────────────────"
  cp -r .next/static .next/standalone/.next/static
  [ -d public ] && cp -r public .next/standalone/public 2>/dev/null || true

  echo "── Restarting services ─────────────────────────────────"
  restart
}

logs()     { tail -f "$APP_LOG" "$OS_LOG" 2>/dev/null; }
logs_app() { tail -f "$APP_LOG" 2>/dev/null; }
logs_os()  { tail -f "$OS_LOG"  2>/dev/null; }

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "${1:-status}" in
  status)   status ;;
  start)    start ;;
  stop)     stop ;;
  restart)  restart ;;
  deploy)   deploy ;;
  logs)     logs ;;
  logs:app) logs_app ;;
  logs:os)  logs_os ;;
  *)
    echo "Usage: $0 {status|start|stop|restart|deploy|logs|logs:app|logs:os}"
    exit 1
    ;;
esac
