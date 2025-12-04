# 🔍 بررسی Terminal - دستورات برای بررسی لاگ‌ها

## 📋 بررسی وضعیت Backend:

### 1. بررسی که Backend در حال اجرا است:
```powershell
Get-Process node
```

### 2. بررسی Health:
```powershell
Invoke-WebRequest http://localhost:5000/api/health
```

### 3. بررسی لاگ‌های Backend:

**در Terminal که Backend را اجرا کردید، باید این لاگ‌ها را ببینید:**

```
🔧 Initializing Telegram bot...
✅ Token found, creating bot instance...
🔄 Creating bot with polling...
✅ Bot instance created
✅ Setting up commands...
📋 Setting up bot commands...
✅ Commands setup completed
🔄 Polling should be active now...
🔄 Testing connection to Telegram...
✅ Telegram bot initialized successfully
🤖 Bot Username: @missionsazd_bot
📡 Bot is ready to receive messages!
🔄 Polling is active - waiting for messages...
```

### 4. وقتی `/start` می‌زنید:

**باید این لاگ را ببینید:**
```
==================================================
📨 NEW MESSAGE RECEIVED
==================================================
   From: حمیدرضا
   Telegram ID: 67195448
   Text: /start
==================================================
```

## 🔧 اگر لاگ `📨 NEW MESSAGE RECEIVED` را نمی‌بینید:

**مشکل:** Polling کار نمی‌کند

**بررسی کنید:**
1. آیا خطای polling در Terminal می‌بینید؟
2. آیا پیام `🔄 Polling is active` را می‌بینید؟
3. آیا Backend در حال اجرا است؟

## 📝 لطفاً:

**لاگ‌های کامل Terminal را کپی کنید و برای من بفرستید** تا ببینم دقیقاً چه اتفاقی می‌افتد.

**یا اگر می‌توانید، اسکرین‌شات از Terminal بگیرید.**

