# 🤖 راهنمای کامل راه‌اندازی ربات تلگرام

## ⚠️ مهم: نیازی به نوشتن کد در ربات نیست!

تمام کدهای ربات در backend نوشته شده است. شما فقط باید:

1. یک ربات از BotFather بسازید
2. Token را دریافت کنید
3. Token را در فایل `.env` قرار دهید
4. Backend را راه‌اندازی مجدد کنید

## مرحله 1: ساخت ربات از BotFather

1. در تلگرام به **@BotFather** پیام بدهید
2. دستور `/newbot` را بفرستید
3. یک نام برای ربات انتخاب کنید (مثلاً: Sales Mission Bot)
4. یک username انتخاب کنید که به `bot` ختم شود (مثلاً: `sales_mission_bot`)
5. BotFather یک **Token** به شما می‌دهد که شبیه این است:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
   ```

## مرحله 2: تنظیم Token در پروژه

1. فایل `.env` را در پوشه `backend` باز کنید (یا از `env.example` کپی کنید):

```bash
cd backend
copy env.example .env
```

2. فایل `.env` را ویرایش کنید و Token را قرار دهید:

```env
PORT=5000
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
```

⚠️ **نکته مهم:** Token را در quotes قرار ندهید!

## مرحله 3: راه‌اندازی مجدد Backend

پس از تنظیم Token، Backend را متوقف و دوباره اجرا کنید:

```powershell
# متوقف کردن Backend
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# اجرای مجدد
cd C:\Users\hamid\sales-mission-manager
npm run dev
```

باید این پیام را ببینید:
```
✅ Telegram bot initialized
```

## مرحله 4: ثبت پرسنل با Telegram ID

قبل از استفاده از ربات، باید پرسنل را با Telegram ID ثبت کنید:

1. در Frontend به `/personnel` بروید
2. یک پرسنل اضافه کنید
3. **Telegram ID** را وارد کنید (عدد ID کاربر در تلگرام)

### پیدا کردن Telegram ID:

1. به ربات **@userinfobot** در تلگرام پیام بدهید
2. عدد `Id` را کپی کنید (مثلاً: `123456789`)
3. این عدد را در فیلد `Telegram ID` در سیستم وارد کنید

## تست ربات

1. در تلگرام با ربات خودتان چت کنید
2. دستور `/start` را بفرستید

**اگر همه چیز درست باشد:**
- اگر پرسنل با Telegram ID ثبت شده: پیام خوش‌آمدگویی می‌بینید
- اگر ثبت نشده: پیام خطا می‌بینید که باید با مدیر تماس بگیرید

## دستورات ربات

بعد از `/start`، می‌توانید از این دستورات استفاده کنید:

- `/start` - شروع کار با ربات
- `/missions` - لیست ماموریت‌های من
- `/pending` - ماموریت‌های در انتظار تایید (فقط مدیران)
- `/approve_<id>` - تایید ماموریت (فقط مدیران)
- `/status <id>` - وضعیت یک ماموریت
- `/help` - راهنما

## عیب‌یابی

### ربات کار نمی‌کند

1. **بررسی Token:**
   ```powershell
   cd backend
   # فایل .env را باز کنید و بررسی کنید که Token درست است
   ```

2. **بررسی لاگ Backend:**
   - باید پیام `✅ Telegram bot initialized` را ببینید
   - اگر پیام `⚠️ TELEGRAM_BOT_TOKEN not set` را دیدید، Token تنظیم نشده

3. **تست Token:**
   ```powershell
   # در Backend لاگ‌ها را بررسی کنید
   # باید خطایی درباره Telegram نباشد
   ```

### ربات پیام نمی‌دهد

1. مطمئن شوید Backend در حال اجرا است
2. مطمئن شوید Token صحیح است
3. مطمئن شوید کاربر با Telegram ID در سیستم ثبت شده است

### خطای "شما در سیستم ثبت نشده‌اید"

1. به Frontend بروید (`/personnel`)
2. پرسنل را اضافه یا ویرایش کنید
3. **Telegram ID** را وارد کنید (عدد ID از @userinfobot)

## مثال کامل

```
1. ساخت ربات:
   /newbot → نام: "Sales Bot" → username: "sales_mission_bot"
   → Token: 1234567890:ABC...

2. تنظیم در .env:
   TELEGRAM_BOT_TOKEN=1234567890:ABC...

3. راه‌اندازی:
   npm run dev

4. ثبت پرسنل:
   - نام: علی
   - شماره: 09123456789
   - Telegram ID: 123456789 (از @userinfobot)

5. تست:
   در تلگرام به ربات /start بفرستید
```

**همه چیز آماده است - فقط Token را تنظیم کنید!** 🎉
