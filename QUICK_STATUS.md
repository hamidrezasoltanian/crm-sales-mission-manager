# وضعیت سریع سرویس‌ها

**آخرین به‌روزرسانی**: 2025-12-03

## ✅ سرویس‌های فعال

### Backend (Port 2001)
- ✅ **وضعیت**: Online
- ✅ **شامل**: API Server + Telegram Bot
- ✅ **Telegram Bot**: @atenazistdarman_bot

### Frontend (Port 2000)
- ✅ **وضعیت**: Online (Dev Mode)
- ✅ **صفحه**: در حال لود شدن

## 📊 دستورات سریع

```bash
cd /home/hamidreza/App/sales-mission-manager

# نمایش وضعیت
npx pm2 list

# راه‌اندازی مجدد
npx pm2 restart all

# نمایش لاگ‌ها
npx pm2 logs

# یا با اسکریپت
./scripts/pm2-manager.sh status
```

## 🔄 Auto-Restart

PM2 به صورت خودکار:
- ✅ سرویس‌های crashed را restart می‌کند
- ✅ بعد از راه‌اندازی مجدد سیستم، سرویس‌ها را شروع می‌کند (بعد از اجرای دستور startup)

## 📝 لاگ‌ها

```bash
# تمام لاگ‌ها
npx pm2 logs

# لاگ‌های backend
npx pm2 logs sales-backend

# لاگ‌های frontend
npx pm2 logs sales-frontend
```

## ⚠️ نکات

- Frontend در dev mode است (برای development)
- برای production، باید build شود و از `npm run start` استفاده شود
- همه سرویس‌ها با PM2 مدیریت می‌شوند

