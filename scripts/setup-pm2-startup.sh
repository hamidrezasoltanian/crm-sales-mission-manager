#!/bin/bash

# Script to setup PM2 startup on system boot

echo "🔧 Setting up PM2 startup..."

cd /home/hamidreza/App/sales-mission-manager

# Generate startup script
npx pm2 startup systemd -u $USER --hp /home/$USER

echo ""
echo "✅ PM2 startup configured!"
echo ""
echo "📝 Next steps:"
echo "   1. Copy the command shown above and run it with sudo"
echo "   2. Then run: cd /home/hamidreza/App/sales-mission-manager && npx pm2 save"
echo ""
echo "🔄 To start all services now:"
echo "   cd /home/hamidreza/App/sales-mission-manager && npx pm2 start ecosystem.config.js"
echo ""
echo "📊 To check status:"
echo "   cd /home/hamidreza/App/sales-mission-manager && npx pm2 status"
echo ""
echo "📋 To view logs:"
echo "   cd /home/hamidreza/App/sales-mission-manager && npx pm2 logs"

