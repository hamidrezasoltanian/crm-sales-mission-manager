#!/bin/bash

echo "🔄 Stopping all existing servers..."
pkill -9 -f "node src/server.js" 2>/dev/null
lsof -ti:2001 | xargs kill -9 2>/dev/null

echo "⏳ Waiting for cleanup..."
sleep 3

echo "🚀 Starting server..."
cd /home/hamidreza/App/sales-mission-manager/backend
nohup node src/server.js > server.log 2>&1 &
NEW_PID=$!

echo "✅ Server started with PID: $NEW_PID"
sleep 4

echo ""
echo "📋 Last 30 lines of log:"
tail -n 30 server.log

echo ""
echo "🔍 Process status:"
ps aux | grep "$NEW_PID" | grep -v grep

