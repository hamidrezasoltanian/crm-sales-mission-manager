# ✅ Token ربات تنظیم شد!

## 🤖 اطلاعات ربات:
- **نام:** Missoins at Atena Zist Darman
- **Username:** @missionsazd_bot
- **Token:** تنظیم شده در `backend/.env`

## ✅ وضعیت:
✅ Token تنظیم شد  
✅ اتصال به Telegram موفق بود  
✅ ربات آماده استفاده است  

## 🚀 راه‌اندازی:

Backend در حال راه‌اندازی است. در Terminal باید این پیام‌ها را ببینید:

```
✅ Telegram bot initialized successfully
🤖 Bot Username: @missionsazd_bot
📝 Bot Name: Missoins at Atena Zist Darman
✅ Database ready
✅ Server is running on port 5000
```

## 📱 تست ربات:

1. **در تلگرام به @missionsazd_bot بروید**
2. دستور `/start` را بفرستید

**اگر این پیام را دیدید یعنی کار می‌کند:**
```
👋 سلام [نام]!
📋 دستورات موجود:
/missions - لیست ماموریت‌های من
...
```

**اگر این پیام را دیدید:**
```
❌ شما در سیستم ثبت نشده‌اید.
📍 Telegram ID شما: [عدد]
```
یعنی باید:
1. به Frontend بروید (`http://localhost:3000/personnel`)
2. پرسنل را اضافه کنید
3. Telegram ID را وارد کنید (از پیام بالا کپی کنید)

## 📋 دستورات ربات:

- `/start` - شروع کار با ربات
- `/missions` - لیست ماموریت‌های من
- `/pending` - ماموریت‌های در انتظار تایید (فقط مدیران)
- `/approve_<id>` - تایید ماموریت (فقط مدیران)
- `/status <id>` - وضعیت یک ماموریت
- `/help` - راهنما

## 🔧 اگر کار نکرد:

1. **بررسی لاگ Backend:**
   - باید `✅ Telegram bot initialized successfully` را ببینید
   - اگر خطایی بود، بررسی کنید

2. **راه‌اندازی مجدد:**
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
   cd C:\Users\hamid\sales-mission-manager
   npm run dev
   ```

3. **تست Token:**
   ```powershell
   cd backend
   node scripts/test-telegram.js
   ```

**همه چیز آماده است! ربات کار می‌کند! 🎉**

