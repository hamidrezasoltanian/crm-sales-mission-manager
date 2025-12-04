# 🤖 وضعیت ربات تلگرام

## ✅ تنظیمات انجام شده:
- ✅ Token در `backend/.env` تنظیم شده
- ✅ Token تست شده و معتبر است
- ✅ Backend در حال راه‌اندازی است

## 🤖 اطلاعات ربات:
- **Username:** @missionsazd_bot
- **نام:** Missoins at Atena Zist Darman
- **Token:** تنظیم شده ✅

## 🚀 تست ربات:

### مرحله 1: بررسی Backend
در Terminal که Backend را اجرا کردید، باید این پیام‌ها را ببینید:

```
✅ Telegram bot initialized successfully
🤖 Bot Username: @missionsazd_bot
📝 Bot Name: Missoins at Atena Zist Darman
✅ Database ready
✅ Server is running on port 5000
```

### مرحله 2: تست در تلگرام
1. در تلگرام به **@missionsazd_bot** بروید
2. دستور `/start` را بفرستید

### نتایج ممکن:

#### ✅ اگر کار کند:
```
👋 سلام [نام]!
📋 دستورات موجود:
/missions - لیست ماموریت‌های من
...
```

#### ⚠️ اگر این پیام را دیدید:
```
❌ شما در سیستم ثبت نشده‌اید.
📍 Telegram ID شما: [عدد]
```

**راه‌حل:**
1. به Frontend بروید: `http://localhost:3000/personnel`
2. پرسنل را اضافه کنید
3. Telegram ID را از پیام ربات کپی کنید و وارد کنید

## 🔧 اگر ربات کار نمی‌کند:

### 1. بررسی لاگ Backend
در Terminal باید این پیام را ببینید:
```
✅ Telegram bot initialized successfully
```

اگر این پیام را نمی‌بینید:
- بررسی کنید که Token در `.env` درست است
- Backend را راه‌اندازی مجدد کنید

### 2. راه‌اندازی مجدد
```powershell
# متوقف کردن
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# اجرای مجدد
cd C:\Users\hamid\sales-mission-manager\backend
node src/server.js
```

### 3. تست Token
```powershell
cd backend
node scripts/test-telegram.js
```

## 📋 دستورات ربات:

- `/start` - شروع کار با ربات
- `/missions` - لیست ماموریت‌های من
- `/pending` - ماموریت‌های در انتظار تایید (مدیران)
- `/approve_<id>` - تایید ماموریت (مدیران)
- `/status <id>` - وضعیت یک ماموریت
- `/help` - راهنما

## 🎯 مراحل بعدی:

1. ✅ Token تنظیم شد
2. ✅ Backend راه‌اندازی شد
3. ⏳ تست در تلگرام
4. ⏳ ثبت پرسنل با Telegram ID
5. ⏳ تست کامل ربات

**همه چیز آماده است! ربات باید کار کند! 🎉**

