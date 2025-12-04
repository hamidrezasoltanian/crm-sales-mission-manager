#!/bin/bash
# Script to start frontend server

cd /home/hamidreza/App/sales-mission-manager/frontend

# Kill any existing processes
pkill -f "next.*dev" || true
pkill -f "next.*start" || true
pkill -f "npm.*dev" || true

# Wait a bit for processes to terminate
sleep 2

# Start the frontend
npm run dev > /tmp/frontend.log 2>&1 &

echo "Frontend started on port 2000"
echo "Logs: /tmp/frontend.log"

