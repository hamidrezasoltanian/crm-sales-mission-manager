# راهنمای مدیریت سرویس‌ها با PM2

این راهنما نحوه مدیریت و مانیتورینگ تمام سرویس‌های اپلیکیشن را با استفاده از PM2 توضیح می‌دهد.

## 📋 فهرست مطالب

- [نصب و راه‌اندازی](#نصب-و-راه‌اندازی)
- [دستورات مدیریت](#دستورات-مدیریت)
- [تنظیم Auto-Start](#تنظیم-auto-start)
- [مانیتورینگ](#مانیتورینگ)
- [لاگ‌ها](#لاگ‌ها)
- [عیب‌یابی](#عیب‌یابی)

## 🚀 نصب و راه‌اندازی

PM2 قبلاً نصب شده است. برای شروع استفاده:

```bash
cd /home/hamidreza/App/sales-mission-manager
./scripts/pm2-manager.sh start
```

## 📊 دستورات مدیریت

### استفاده از اسکریپت مدیریت (پیشنهادی)

```bash
cd /home/hamidreza/App/sales-mission-manager

# شروع تمام سرویس‌ها
./scripts/pm2-manager.sh start

# توقف تمام سرویس‌ها
./scripts/pm2-manager.sh stop

# راه‌اندازی مجدد تمام سرویس‌ها
./scripts/pm2-manager.sh restart

# نمایش وضعیت سرویس‌ها
./scripts/pm2-manager.sh status

# نمایش لاگ‌ها
./scripts/pm2-manager.sh logs

# نمایش لاگ‌های backend
./scripts/pm2-manager.sh logs-backend

# نمایش لاگ‌های frontend
./scripts/pm2-manager.sh logs-frontend

# باز کردن داشبورد مانیتورینگ
./scripts/pm2-manager.sh monitor

# ذخیره تنظیمات PM2
./scripts/pm2-manager.sh save
```

### استفاده مستقیم از PM2

```bash
cd /home/hamidreza/App/sales-mission-manager

# شروع سرویس‌ها
npx pm2 start ecosystem.config.js

# نمایش وضعیت
npx pm2 list

# نمایش لاگ‌ها
npx pm2 logs

# راه‌اندازی مجدد
npx pm2 restart all

# توقف
npx pm2 stop all

# حذف
npx pm2 delete all
```

## ⚙️ تنظیم Auto-Start

برای اینکه سرویس‌ها به صورت خودکار بعد از راه‌اندازی مجدد سیستم شروع شوند:

```bash
cd /home/hamidreza/App/sales-mission-manager

# تولید دستور startup
npx pm2 startup systemd -u $USER --hp /home/$USER

# کپی دستور نمایش داده شده و اجرا با sudo
# مثلاً:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u hamidreza --hp /home/hamidreza

# ذخیره لیست فعلی سرویس‌ها
npx pm2 save
```

یا از اسکریپت آماده استفاده کنید:

```bash
cd /home/hamidreza/App/sales-mission-manager
./scripts/setup-pm2-startup.sh
```

## 📈 مانیتورینگ

### نمایش وضعیت

```bash
npx pm2 list
```

خروجی شامل:
- **id**: شناسه سرویس
- **name**: نام سرویس
- **status**: وضعیت (online/stopped/errored)
- **uptime**: مدت زمان اجرا
- **↺**: تعداد restart
- **cpu**: استفاده CPU
- **mem**: استفاده حافظه

### داشبورد مانیتورینگ

```bash
npx pm2 monit
```

این دستور یک داشبورد تعاملی نمایش می‌دهد که شامل:
- استفاده CPU و RAM
- لاگ‌های زنده
- وضعیت سرویس‌ها

## 📝 لاگ‌ها

### مشاهده لاگ‌ها

```bash
# تمام لاگ‌ها
npx pm2 logs

# لاگ‌های یک سرویس خاص
npx pm2 logs sales-backend
npx pm2 logs sales-frontend

# آخرین 100 خط
npx pm2 logs --lines 100

# پاک کردن لاگ‌ها
npx pm2 flush
```

### مسیر فایل‌های لاگ

لاگ‌ها در مسیرهای زیر ذخیره می‌شوند:

```
/home/hamidreza/App/sales-mission-manager/logs/
├── backend-error.log      # خطاهای backend
├── backend-out.log        # خروجی backend
├── backend-combined.log   # لاگ ترکیبی backend
├── frontend-error.log     # خطاهای frontend
├── frontend-out.log       # خروجی frontend
└── frontend-combined.log  # لاگ ترکیبی frontend
```

## 🔧 عیب‌یابی

### بررسی وضعیت سرویس

```bash
npx pm2 list
```

اگر سرویسی `errored` یا `stopped` است:

```bash
# نمایش جزئیات خطا
npx pm2 logs sales-backend --err

# راه‌اندازی مجدد
npx pm2 restart sales-backend

# نمایش اطلاعات کامل
npx pm2 describe sales-backend
```

### راه‌اندازی مجدد دستی

```bash
# راه‌اندازی مجدد یک سرویس
npx pm2 restart sales-backend

# راه‌اندازی مجدد همه
npx pm2 restart all

# راه‌اندازی مجدد با توقف کامل
npx pm2 reload all
```

### پاک کردن و شروع مجدد

```bash
# حذف همه سرویس‌ها
npx pm2 delete all

# شروع مجدد از فایل config
npx pm2 start ecosystem.config.js

# ذخیره
npx pm2 save
```

## 📦 سرویس‌های مدیریت شده

### sales-backend
- **Port**: 2001
- **Script**: `backend/src/server.js`
- **شامل**: API Server + Telegram Bot

### sales-frontend
- **Port**: 2000
- **Script**: `npm run start` (Next.js production)
- **نیاز به build**: بله (`npm run build`)

## 🔄 تنظیمات Auto-Restart

PM2 به صورت خودکار:
- ✅ سرویس‌های crashed را restart می‌کند
- ✅ بعد از راه‌اندازی مجدد سیستم، سرویس‌ها را شروع می‌کند
- ✅ لاگ‌ها را مدیریت می‌کند
- ✅ استفاده از منابع را مانیتور می‌کند

### تنظیمات در `ecosystem.config.js`:

- `autorestart: true` - راه‌اندازی مجدد خودکار
- `max_restarts: 10` - حداکثر 10 بار restart در 1 دقیقه
- `min_uptime: '10s'` - حداقل 10 ثانیه uptime برای restart موفق
- `restart_delay: 4000` - 4 ثانیه تاخیر بین restart
- `max_memory_restart: '500M'` - restart در صورت استفاده بیش از 500MB RAM

## 📞 دستورات مفید

```bash
# نمایش اطلاعات یک سرویس
npx pm2 describe sales-backend

# نمایش استفاده منابع
npx pm2 monit

# نمایش اطلاعات سیستم
npx pm2 info

# نمایش نسخه PM2
npx pm2 --version

# نمایش help
npx pm2 --help
```

## ⚠️ نکات مهم

1. **Build Frontend**: قبل از شروع frontend با PM2، باید build شود:
   ```bash
   cd frontend && npm run build
   ```

2. **Environment Variables**: مطمئن شوید فایل `.env` در backend وجود دارد.

3. **Ports**: مطمئن شوید پورت‌های 2000 و 2001 آزاد هستند.

4. **Permissions**: اگر مشکلی در اجرا دارید، بررسی کنید که کاربر دسترسی لازم را دارد.

5. **Logs**: لاگ‌ها را به صورت منظم بررسی کنید تا از سلامت سرویس‌ها مطمئن شوید.

## 🆘 در صورت مشکل

1. بررسی لاگ‌ها:
   ```bash
   npx pm2 logs --err
   ```

2. بررسی وضعیت:
   ```bash
   npx pm2 list
   ```

3. راه‌اندازی مجدد:
   ```bash
   npx pm2 restart all
   ```

4. اگر مشکل حل نشد:
   ```bash
   npx pm2 delete all
   npx pm2 start ecosystem.config.js
   npx pm2 save
   ```

