#!/bin/bash
# Monitoring script to check if backend and frontend are running
# This script should be run every few minutes via cron

APP_DIR="/home/hamidreza/App/sales-mission-manager"
BACKEND_PORT=2001
FRONTEND_PORT=2000
CHECK_INTERVAL=300  # 5 minutes in seconds

# Function to check if a port is listening
check_port() {
    local port=$1
    local service=$2
    
    # Try multiple methods to check port (order matters - try most reliable first)
    if command -v ss >/dev/null 2>&1; then
        if ss -tuln 2>/dev/null | grep -q ":$port.*LISTEN"; then
            return 0  # Port is listening
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -tuln 2>/dev/null | grep -q ":$port.*LISTEN"; then
            return 0  # Port is listening
        fi
    elif command -v lsof >/dev/null 2>&1; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 0  # Port is listening
        fi
    fi
    
    # Fallback: try to connect to port
    if timeout 1 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
        return 0  # Port is listening
    fi
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ❌ $service is DOWN on port $port"
    return 1  # Port is not listening
}

# Function to start backend
start_backend() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 🔄 Starting backend..."
    
    # Kill existing processes
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "npm.*start" 2>/dev/null || true
    sleep 2
    
    cd "$APP_DIR/backend"
    export PORT=$BACKEND_PORT
    export NODE_ENV=production
    nohup npm start > /tmp/backend.log 2>&1 &
    sleep 5
    
    if check_port $BACKEND_PORT "Backend"; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ✅ Backend started successfully"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ❌ Failed to start backend"
        echo "Last 10 lines of backend log:"
        tail -10 /tmp/backend.log 2>/dev/null || true
    fi
}

# Function to start frontend
start_frontend() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 🔄 Starting frontend..."
    
    # Kill existing processes
    pkill -f "next.*dev" 2>/dev/null || true
    pkill -f "next.*start" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    sleep 2
    
    cd "$APP_DIR/frontend"
    export NEXT_PUBLIC_API_URL=http://localhost:2001/api
    nohup npm run dev > /tmp/frontend.log 2>&1 &
    
    # Wait for frontend to start (it takes longer)
    local max_wait=30
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if check_port $FRONTEND_PORT "Frontend" 2>/dev/null; then
            break
        fi
        sleep 2
        waited=$((waited + 2))
    done
    
    if check_port $FRONTEND_PORT "Frontend"; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ✅ Frontend started successfully"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ❌ Failed to start frontend"
        echo "Last 10 lines of frontend log:"
        tail -10 /tmp/frontend.log 2>/dev/null || true
    fi
}

# Function to check database
check_database() {
    local db_path="$APP_DIR/backend/data/missions.db"
    if [ ! -f "$db_path" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ⚠️  Database file not found at $db_path"
        # Try to create directory if it doesn't exist
        mkdir -p "$APP_DIR/backend/data"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - 📁 Created data directory"
    fi
}

# Function to check Telegram bot
check_telegram_bot() {
    # Check if backend is running and bot is initialized
    # We can check by looking at the backend log for bot initialization messages
    if [ -f /tmp/backend.log ]; then
        # Check if bot was initialized in the last 5 minutes
        if tail -100 /tmp/backend.log 2>/dev/null | grep -q "Bot is ready to receive messages"; then
            # Check if backend process is still running
            if pgrep -f "node.*server.js" > /dev/null; then
                return 0  # Bot is running
            fi
        fi
    fi
    return 1  # Bot might not be running
}

# Main monitoring function
main() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 🔍 Checking services..."
    
    # Check database
    check_database
    
    # Check backend
    if ! check_port $BACKEND_PORT "Backend"; then
        start_backend
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ✅ Backend is running"
        
        # Check Telegram bot
        if ! check_telegram_bot; then
            echo "$(date '+%Y-%m-%d %H:%M:%S') - ⚠️  Telegram bot might not be running, restarting backend..."
            # Kill backend
            pkill -f "node.*server.js" 2>/dev/null || true
            pkill -f "npm.*start" 2>/dev/null || true
            sleep 2
            start_backend
        else
            echo "$(date '+%Y-%m-%d %H:%M:%S') - ✅ Telegram bot is running"
        fi
    fi
    
    # Check frontend
    if ! check_port $FRONTEND_PORT "Frontend"; then
        start_frontend
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - ✅ Frontend is running"
    fi
}

# Run main function
main

