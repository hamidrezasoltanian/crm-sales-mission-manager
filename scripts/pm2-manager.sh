#!/bin/bash

# PM2 Manager Script - Easy management of all services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PM2_CMD="npx pm2"

case "$1" in
  start)
    echo "🚀 Starting all services..."
    $PM2_CMD start ecosystem.config.js
    $PM2_CMD save
    ;;
  stop)
    echo "⏹️  Stopping all services..."
    $PM2_CMD stop ecosystem.config.js
    ;;
  restart)
    echo "🔄 Restarting all services..."
    $PM2_CMD restart ecosystem.config.js
    ;;
  status)
    echo "📊 Service Status:"
    $PM2_CMD list
    ;;
  logs)
    echo "📋 Viewing logs (Ctrl+C to exit)..."
    $PM2_CMD logs
    ;;
  logs-backend)
    echo "📋 Backend logs..."
    $PM2_CMD logs sales-backend --lines 50
    ;;
  logs-frontend)
    echo "📋 Frontend logs..."
    $PM2_CMD logs sales-frontend --lines 50
    ;;
  monitor)
    echo "📊 Monitoring dashboard..."
    $PM2_CMD monit
    ;;
  save)
    echo "💾 Saving PM2 configuration..."
    $PM2_CMD save
    ;;
  delete)
    echo "🗑️  Deleting all PM2 processes..."
    $PM2_CMD delete all
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|logs-backend|logs-frontend|monitor|save|delete}"
    echo ""
    echo "Commands:"
    echo "  start          - Start all services"
    echo "  stop           - Stop all services"
    echo "  restart        - Restart all services"
    echo "  status         - Show service status"
    echo "  logs           - View all logs"
    echo "  logs-backend   - View backend logs"
    echo "  logs-frontend  - View frontend logs"
    echo "  monitor        - Open monitoring dashboard"
    echo "  save           - Save PM2 configuration"
    echo "  delete         - Delete all PM2 processes"
    exit 1
    ;;
esac

