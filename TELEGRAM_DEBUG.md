# 🔧 دیباگ ربات تلگرام

## مشکل: ربات کار نمی‌کند و پیامی نمی‌دهد

### تغییرات انجام شده:

1. ✅ **لاگ‌های بیشتر اضافه شد**
   - هر مرحله از initialization لاگ می‌شود
   - تمام پیام‌های دریافتی لاگ می‌شوند
   - خطاها با جزئیات بیشتر نمایش داده می‌شوند

2. ✅ **اسکریپت دیباگ ایجاد شد**
   - `backend/scripts/debug-telegram.js`
   - برای تست مستقیم ربات

## 🔍 بررسی مشکلات:

### 1. بررسی لاگ‌های Backend

در Terminal که Backend را اجرا کردید، باید این پیام‌ها را ببینید:

```
🔧 Initializing Telegram bot...
✅ Token found, creating bot instance...
✅ Bot instance created, setting up commands...
📋 Setting up bot commands...
✅ Commands setup completed
🔄 Testing connection to Telegram...
✅ Telegram bot initialized successfully
🤖 Bot Username: @missionsazd_bot
📝 Bot Name: Missoins at Atena Zist Darman
📡 Bot is ready to receive messages!
```

### 2. اگر خطایی دیدید:

#### خطا: "TELEGRAM_BOT_TOKEN not set"
- بررسی کنید که Token در `.env` تنظیم شده است
- Backend را راه‌اندازی مجدد کنید

#### خطا: "Telegram bot connection error"
- Token ممکن است اشتباه باشد
- یا ربات در BotFather غیرفعال شده باشد

#### خطا: "Polling error"
- ممکن است مشکل شبکه باشد
- یا Telegram API در دسترس نباشد

### 3. تست با اسکریپت دیباگ

```powershell
cd backend
node scripts/debug-telegram.js
```

این اسکریپت:
- ربات را به صورت مستقیم تست می‌کند
- تمام پیام‌های دریافتی را نمایش می‌دهد
- می‌توانید ببینید آیا ربات پیام‌ها را دریافت می‌کند یا نه

### 4. بررسی در Terminal

وقتی پیامی به ربات می‌فرستید، باید این لاگ را ببینید:

```
📨 Received message from [نام]: [متن پیام]
📥 /start command received from [ID]
```

اگر این لاگ را نمی‌بینید:
- ربات پیام‌ها را دریافت نمی‌کند
- مشکل در polling است

## 🔧 راه‌حل‌های احتمالی:

### راه‌حل 1: راه‌اندازی مجدد
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
cd C:\Users\hamid\sales-mission-manager\backend
node src/server.js
```

### راه‌حل 2: تست مستقیم
```powershell
cd backend
node scripts/debug-telegram.js
```

### راه‌حل 3: بررسی Token
```powershell
cd backend
node scripts/test-telegram.js
```

## 📝 چک‌لیست:

- [ ] Token در `.env` تنظیم شده است
- [ ] Backend در حال اجرا است
- [ ] لاگ "✅ Telegram bot initialized successfully" را می‌بینید
- [ ] وقتی پیام می‌فرستید، لاگ "📨 Received message" را می‌بینید
- [ ] ربات در تلگرام پاسخ می‌دهد

## 🆘 اگر هنوز کار نمی‌کند:

1. **لاگ‌های Terminal را بررسی کنید**
   - تمام خطاها را کپی کنید
   - برای من بفرستید

2. **تست با اسکریپت دیباگ**
   - `node scripts/debug-telegram.js` را اجرا کنید
   - ببینید آیا پیام‌ها را دریافت می‌کند

3. **بررسی Token**
   - مطمئن شوید Token درست است
   - از @BotFather دوباره بگیرید اگر نیاز است

**لاگ‌های بیشتری اضافه شد. حالا می‌توانیم ببینیم دقیقاً کجا مشکل است!** 🔍

