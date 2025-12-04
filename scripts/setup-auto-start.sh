#!/bin/bash
# Script to setup auto-start services

APP_DIR="/home/hamidreza/App/sales-mission-manager"
SCRIPTS_DIR="$APP_DIR/scripts"

echo "🔧 Setting up auto-start for Sales Mission Manager..."
echo ""

# Check if running as root for systemd
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges to install systemd services"
    echo "Please run: sudo $0"
    exit 1
fi

# Copy systemd service files
echo "📋 Installing systemd services..."
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

echo ""
echo "✅ Services installed and started!"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status sales-mission-manager-backend"
echo "  sudo systemctl status sales-mission-manager-frontend"
echo "  sudo systemctl restart sales-mission-manager-backend"
echo "  sudo systemctl restart sales-mission-manager-frontend"
echo "  sudo systemctl stop sales-mission-manager-backend"
echo "  sudo systemctl stop sales-mission-manager-frontend"
echo "  journalctl -u sales-mission-manager-backend -f"
echo "  journalctl -u sales-mission-manager-frontend -f"

