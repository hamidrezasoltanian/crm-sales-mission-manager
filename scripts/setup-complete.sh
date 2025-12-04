#!/bin/bash
# Complete setup script for auto-start and monitoring
# This script sets up both systemd services and cron monitoring

APP_DIR="/home/hamidreza/App/sales-mission-manager"
SCRIPTS_DIR="$APP_DIR/scripts"

echo "🚀 Setting up complete auto-start and monitoring for Sales Mission Manager..."
echo ""

# Check if running as root for systemd
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges to install systemd services"
    echo "Please run: sudo $0"
    exit 1
fi

# Step 1: Setup systemd services
echo "📋 Step 1: Installing systemd services..."
cp "$SCRIPTS_DIR/sales-mission-manager-backend.service" /etc/systemd/system/
cp "$SCRIPTS_DIR/sales-mission-manager-frontend.service" /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable services (start on boot)
echo "🔌 Enabling services to start on boot..."
systemctl enable sales-mission-manager-backend.service
systemctl enable sales-mission-manager-frontend.service

# Start services
echo "🚀 Starting services..."
systemctl start sales-mission-manager-backend.service
systemctl start sales-mission-manager-frontend.service

# Step 2: Setup monitoring cron job
echo ""
echo "📋 Step 2: Setting up monitoring cron job..."

# Make monitor script executable
chmod +x "$SCRIPTS_DIR/monitor.sh"

# Add cron job (runs every 5 minutes)
CRON_JOB="*/5 * * * * $SCRIPTS_DIR/monitor.sh >> $SCRIPTS_DIR/monitor.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$SCRIPTS_DIR/monitor.sh"; then
    echo "⚠️  Monitoring cron job already exists, updating..."
    # Remove old cron job
    crontab -l 2>/dev/null | grep -v "$SCRIPTS_DIR/monitor.sh" | crontab -
fi

# Add to crontab
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
echo "✅ Monitoring cron job added (runs every 5 minutes)"

# Step 3: Verify everything is set up
echo ""
echo "📋 Step 3: Verifying setup..."

# Check systemd services
if systemctl is-enabled sales-mission-manager-backend.service >/dev/null 2>&1 && \
   systemctl is-enabled sales-mission-manager-frontend.service >/dev/null 2>&1; then
    echo "✅ Systemd services are enabled"
else
    echo "❌ Systemd services are not enabled"
fi

# Check cron job
if crontab -l 2>/dev/null | grep -q "$SCRIPTS_DIR/monitor.sh"; then
    echo "✅ Monitoring cron job is active"
    echo "   Cron schedule: */5 * * * * (every 5 minutes)"
else
    echo "❌ Monitoring cron job is not active"
fi

# Check if services are running
if systemctl is-active sales-mission-manager-backend.service >/dev/null 2>&1; then
    echo "✅ Backend service is running"
else
    echo "⚠️  Backend service is not running"
fi

if systemctl is-active sales-mission-manager-frontend.service >/dev/null 2>&1; then
    echo "✅ Frontend service is running"
else
    echo "⚠️  Frontend service is not running"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Summary:"
echo "  - Systemd services: Enabled (auto-start on boot)"
echo "  - Monitoring cron: Active (checks every 5 minutes)"
echo "  - Monitor log: $SCRIPTS_DIR/monitor.log"
echo ""
echo "📝 Useful commands:"
echo "  # Check service status"
echo "  sudo systemctl status sales-mission-manager-backend"
echo "  sudo systemctl status sales-mission-manager-frontend"
echo ""
echo "  # View logs"
echo "  sudo journalctl -u sales-mission-manager-backend -f"
echo "  sudo journalctl -u sales-mission-manager-frontend -f"
echo "  tail -f $SCRIPTS_DIR/monitor.log"
echo ""
echo "  # Restart services"
echo "  sudo systemctl restart sales-mission-manager-backend"
echo "  sudo systemctl restart sales-mission-manager-frontend"
echo ""
echo "  # Check monitoring"
echo "  crontab -l | grep monitor"
echo "  bash $SCRIPTS_DIR/monitor.sh"

