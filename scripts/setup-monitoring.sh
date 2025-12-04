#!/bin/bash
# Script to setup monitoring cron job

APP_DIR="/home/hamidreza/App/sales-mission-manager"
MONITOR_SCRIPT="$APP_DIR/scripts/monitor-services.sh"
CRON_LOG="$APP_DIR/scripts/monitor.log"

echo "🔧 Setting up monitoring..."
echo ""

# Make monitor script executable
chmod +x "$MONITOR_SCRIPT"

# Add cron job (runs every 5 minutes, single-pass mode)
CRON_JOB="*/5 * * * * $MONITOR_SCRIPT --once >> $CRON_LOG 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$MONITOR_SCRIPT"; then
    echo "⚠️  Monitoring cron job already exists"
    echo "Current crontab:"
    crontab -l | grep "$MONITOR_SCRIPT"
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Monitoring cron job added (runs every 5 minutes)"
fi

echo ""
echo "✅ Monitoring setup complete!"
echo "Monitor script: $MONITOR_SCRIPT"
echo "Monitor log: $CRON_LOG"
echo ""
echo "To view monitoring logs:"
echo "  tail -f $CRON_LOG"
echo ""
echo "To remove monitoring:"
echo "  crontab -e  # Remove the line with monitor.sh"

