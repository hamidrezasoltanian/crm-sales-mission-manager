#!/bin/bash
# Script to start backend server

cd /home/hamidreza/App/sales-mission-manager/backend

# Kill any existing processes
pkill -f "node.*server.js" || true
pkill -f "npm.*start" || true

# Wait a bit for processes to terminate
sleep 2

# Start the backend
export PORT=2001
npm start > /tmp/backend.log 2>&1 &

echo "Backend started on port 2001"
echo "Logs: /tmp/backend.log"

