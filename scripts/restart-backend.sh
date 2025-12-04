#!/bin/bash
# Script to restart backend (includes Telegram bot)

APP_DIR="/home/hamidreza/App/sales-mission-manager"

echo "🔄 Restarting backend and Telegram bot..."

# Kill existing processes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
sleep 2

# Start backend (which includes Telegram bot)
cd "$APP_DIR/backend"
export PORT=2001
export NODE_ENV=production
nohup npm start > /tmp/backend.log 2>&1 &

echo "✅ Backend restart initiated"
echo "📋 Check logs: tail -f /tmp/backend.log"
echo ""
echo "Waiting for startup..."
sleep 5

# Check if it started
if lsof -Pi :2001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Backend is running on port 2001"
    
    # Check Telegram bot
    sleep 3
    if tail -50 /tmp/backend.log 2>/dev/null | grep -q "Bot is ready to receive messages"; then
        echo "✅ Telegram bot is initialized"
        tail -50 /tmp/backend.log | grep -E "Bot Username|Bot Name|Bot is ready" | tail -3
    else
        echo "⚠️  Telegram bot initialization might be in progress..."
        echo "Check logs for details: tail -f /tmp/backend.log"
    fi
else
    echo "❌ Backend failed to start"
    echo "Last 20 lines of log:"
    tail -20 /tmp/backend.log 2>/dev/null || true
fi

