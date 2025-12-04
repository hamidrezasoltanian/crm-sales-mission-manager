#!/bin/bash
# Script to start both backend and frontend

APP_DIR="/home/hamidreza/App/sales-mission-manager"

echo "🚀 Starting Sales Mission Manager..."
echo ""

# Start backend
echo "📦 Starting backend..."
cd "$APP_DIR/backend"
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
sleep 2
export PORT=2001
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo "Backend logs: /tmp/backend.log"

# Wait for backend to start
sleep 5

# Start frontend
echo ""
echo "🎨 Starting frontend..."
cd "$APP_DIR/frontend"
pkill -f "next.*dev" 2>/dev/null || true
pkill -f "next.*start" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
sleep 2
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
echo "Frontend logs: /tmp/frontend.log"

echo ""
echo "✅ Services started!"
echo "Backend: http://localhost:2001"
echo "Frontend: http://localhost:2000"
echo ""
echo "To check logs:"
echo "  tail -f /tmp/backend.log"
echo "  tail -f /tmp/frontend.log"

