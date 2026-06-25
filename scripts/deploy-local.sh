#!/usr/bin/env bash
# Local production deployment helper for Agent Explorer
# Usage:
#   ./scripts/deploy-local.sh          # rebuild + reload
#   ./scripts/deploy-local.sh start    # just (re)load launchd
#   ./scripts/deploy-local.sh stop     # stop service
#   ./scripts/deploy-local.sh logs     # tail logs
#   ./scripts/deploy-local.sh status   # check health

set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/agent.explorer.plist"
URL="http://127.0.0.1:3001"

case "${1:-rebuild}" in
  rebuild)
    echo "→ Building production bundle..."
    cd "$DIR"
    npm run build
    # Sync static assets into standalone
    cp -r .next/static .next/standalone/.next/static
    [ -d public ] && cp -r public .next/standalone/public 2>/dev/null || true
    echo "→ Reloading service..."
    launchctl unload "$PLIST" 2>/dev/null || true
    sleep 1
    launchctl load "$PLIST"
    sleep 5
    curl -s "$URL" | grep -q '<title>' && echo "✅ Agent Explorer running at $URL" || echo "❌ Service not responding"
    ;;
  start)
    launchctl unload "$PLIST" 2>/dev/null || true
    sleep 1
    launchctl load "$PLIST"
    sleep 5
    curl -s "$URL" | grep -q '<title>' && echo "✅ Running at $URL" || echo "❌ Not responding"
    ;;
  stop)
    launchctl unload "$PLIST" 2>/dev/null && echo "✅ Stopped" || echo "Already stopped"
    ;;
  logs)
    tail -f /tmp/agent-explorer.log
    ;;
  status)
    if curl -s "$URL" | grep -q '<title>'; then
      echo "✅ Agent Explorer is running at $URL"
    else
      echo "❌ Agent Explorer is not responding"
      echo "   Logs: /tmp/agent-explorer.log"
    fi
    ;;
  *)
    echo "Usage: $0 [rebuild|start|stop|logs|status]"
    ;;
esac
