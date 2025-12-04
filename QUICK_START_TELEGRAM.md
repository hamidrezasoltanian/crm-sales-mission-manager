# 🚀 راه‌اندازی سریع ربات تلگرام

## ⚠️ **مهم: نیازی به نوشتن کد نیست!**

همه کدها آماده است. فقط 3 مرحله:

## 📝 مراحل:

### 1️⃣ ساخت ربات (30 ثانیه)
1. در تلگرام به **@BotFather** پیام بدهید
2. `/newbot` را بفرستید
3. نام و username انتخاب کنید
4. **Token** را کپی کنید (مثلاً: `1234567890:ABC...`)

### 2️⃣ تنظیم Token (30 ثانیه)
```powershell
cd backend
copy env.example .env
# فایل .env را باز کنید و این خط را ویرایش کنید:
# TELEGRAM_BOT_TOKEN=your-token-here
# را تبدیل کنید به:
# TELEGRAM_BOT_TOKEN=1234567890:ABC... (Token شما)
```

### 3️⃣ راه‌اندازی مجدد (10 ثانیه)
```powershell
# متوقف کردن همه
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# اجرای مجدد
cd C:\Users\hamid\sales-mission-manager
npm run dev
```

باید این پیام را ببینید:
```
✅ Telegram bot initialized successfully
🤖 Bot Username: @your_bot_name
```

## ✅ تست:

1. در تلگرام با ربات خودتان چت کنید
2. `/start` بفرستید

**اگر این پیام را دیدید یعنی کار می‌کند:**
```
👋 سلام [نام]!
📋 دستورات موجود:
/missions - لیست ماموریت‌های من
...
```

## 🔧 اگر کار نکرد:

1. **بررسی Token:** مطمئن شوید Token در `.env` درست است (بدون quotes)
2. **بررسی لاگ:** در terminal باید `✅ Telegram bot initialized` را ببینید
3. **راه‌اندازی مجدد:** Backend را دوباره start کنید

---

📖 **راهنمای کامل:** `docs/TELEGRAM_BOT_SETUP.md`
