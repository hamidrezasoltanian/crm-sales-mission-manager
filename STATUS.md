# وضعیت سرویس‌ها - Sales Mission Manager

**آخرین به‌روزرسانی**: 2025-12-03

## ✅ سرویس‌های فعال

### Backend (Port 2001)
- ✅ **وضعیت**: Online
- ✅ **شامل**: API Server + Telegram Bot
- ✅ **Auto-restart**: فعال
- ✅ **Telegram Bot**: @atenazistdarman_bot

### Frontend (Port 2000)
- ✅ **وضعیت**: Online (Dev Mode)
- ✅ **Auto-restart**: فعال

## 📊 مدیریت با PM2

### دستورات سریع

```bash
cd /home/hamidreza/App/sales-mission-manager

# نمایش وضعیت
./scripts/pm2-manager.sh status

# راه‌اندازی مجدد
./scripts/pm2-manager.sh restart

# نمایش لاگ‌ها
./scripts/pm2-manager.sh logs
```

### دستورات PM2 مستقیم

```bash
cd /home/hamidreza/App/sales-mission-manager

# وضعیت
npx pm2 list

# لاگ‌ها
npx pm2 logs

# راه‌اندازی مجدد
npx pm2 restart all
```

## 🔄 Auto-Start

برای فعال‌سازی auto-start بعد از reboot:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u hamidreza --hp /home/hamidreza
cd /home/hamidreza/App/sales-mission-manager
npx pm2 save
```

## 📝 لاگ‌ها

- Backend: `/home/hamidreza/App/sales-mission-manager/logs/backend-*.log`
- Frontend: `/home/hamidreza/App/sales-mission-manager/logs/frontend-*.log`

## 🔧 تنظیمات

- **PM2 Config**: `ecosystem.config.js`
- **Manager Script**: `scripts/pm2-manager.sh`
- **Setup Script**: `scripts/setup-pm2-startup.sh`

## 📚 مستندات

برای اطلاعات بیشتر، فایل `PM2_SETUP.md` را مطالعه کنید.

