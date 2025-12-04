# 🔍 راهنمای دیباگ ربات تلگرام

## ✅ تغییرات اعمال شده:

1. **لاگ‌های بیشتر اضافه شد** برای ردیابی:
   - ثبت شدن handlers
   - دریافت پیام‌ها
   - پردازش دستورات

2. **تمام process های قبلی متوقف شدند**

3. **Backend راه‌اندازی مجدد شد**

---

## 📋 بررسی لاگ‌ها:

پس از راه‌اندازی backend، باید این لاگ‌ها را ببینید:

```
📋 Setting up bot commands...
🔧 Bot instance: ✅ موجود
📝 Registering /start handler...
📝 Registering /missions handler...
...
✅ Commands setup completed
📊 Total registered handlers:
   - onText handlers: 13
   - callback_query handler: 1
   - message handler: 1
🎯 Bot is ready to receive commands!
✅ Telegram bot initialized successfully
🤖 Bot Username: @your_bot_username
📝 Bot Name: Your Bot Name
📡 Bot is ready to receive messages!
```

---

## 🧪 تست:

1. **در تلگرام دستور `/start` را بزنید**

2. **باید این لاگ‌ها را ببینید:**
   ```
   📨 RAW MESSAGE RECEIVED from 67195448: /start
   ⏭️ Skipping command (handled by onText): /start
   📥 /start command received from 67195448
   ✅ Welcome message sent successfully
   ```

3. **اگر لاگ‌ها را نمی‌بینید:**
   - بررسی کنید که backend در حال اجرا است
   - بررسی کنید که `TELEGRAM_BOT_TOKEN` در `.env` تنظیم شده است
   - بررسی کنید که bot در تلگرام فعال است

---

## 🔧 اگر هنوز کار نمی‌کند:

### 1. بررسی Token:
```bash
cd backend
cat .env | grep TELEGRAM_BOT_TOKEN
```

### 2. بررسی Process ها:
```powershell
Get-Process node
```

اگر چندین process وجود دارد، همه را متوقف کنید:
```powershell
Get-Process node | Stop-Process -Force
```

### 3. بررسی لاگ‌های Backend:
در ترمینال backend باید لاگ‌های زیر را ببینید:
- `📋 Setting up bot commands...`
- `✅ Commands setup completed`
- `✅ Telegram bot initialized successfully`

### 4. تست مستقیم:
اگر هنوز کار نمی‌کند، دستور `/start` را در تلگرام بزنید و لاگ‌های ترمینال را بررسی کنید.

---

## 📝 دستورات موجود:

✅ `/start` - شروع کار با ربات
✅ `/missions` - لیست ماموریت‌های من
✅ `/newmission` - ایجاد ماموریت جدید
✅ `/status` - راهنمای status
✅ `/status <id>` یا `/status_<id>` - جزئیات ماموریت
✅ `/report` - گزارش شخصی
✅ `/complete_center` - تکمیل اطلاعات مرکز
✅ `/add` - افزودن مرکز جدید (مدیران)
✅ `/pending` - ماموریت‌های در انتظار تایید (مدیران)
✅ `/approve` - راهنمای approve
✅ `/approve_<id>` - تایید ماموریت (مدیران)
✅ `/help` - راهنمای کامل

---

## 🚨 مشکلات احتمالی:

1. **چندین instance در حال اجرا:** همه را متوقف کنید
2. **Token نامعتبر:** بررسی کنید `.env` درست است
3. **Polling غیرفعال:** باید `polling: true` باشد
4. **Handler order:** باید `onText` قبل از `on('message')` باشد (✅ درست است)

---

**لطفاً دستور `/start` را در تلگرام بزنید و نتیجه را بگویید!**

