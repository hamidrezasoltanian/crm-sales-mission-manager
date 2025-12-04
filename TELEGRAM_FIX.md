# 🔧 حل مشکل ربات تلگرام

## ❌ مشکل: Token تنظیم نشده است

## ✅ راه‌حل سریع (2 دقیقه):

### مرحله 1: ساخت ربات و دریافت Token

1. **در تلگرام به @BotFather بروید**
2. دستور `/newbot` را بفرستید
3. یک **نام** برای ربات انتخاب کنید (مثلاً: `Sales Bot`)
4. یک **username** انتخاب کنید که به `bot` ختم شود (مثلاً: `sales_bot`)
5. **Token** را که BotFather به شما می‌دهد **کپی** کنید

   مثال Token:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
   ```

### مرحله 2: قرار دادن Token در فایل .env

```powershell
# 1. به پوشه backend بروید
cd C:\Users\hamid\sales-mission-manager\backend

# 2. اگر فایل .env وجود ندارد، از env.example کپی کنید
copy env.example .env

# 3. فایل .env را با Notepad یا ویرایشگر باز کنید
notepad .env
```

در فایل `.env` این خط را پیدا کنید:
```
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here
```

و Token واقعی خود را جایگزین کنید:
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
```

⚠️ **مهم:**
- Token را **بدون quotes** قرار دهید
- بعد از `=` هیچ فاصله نگذارید
- کل Token را دقیقاً کپی کنید

### مرحله 3: راه‌اندازی مجدد Backend

```powershell
# متوقف کردن همه process های Node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# صبر کردن 2 ثانیه
Start-Sleep -Seconds 2

# اجرای مجدد
cd C:\Users\hamid\sales-mission-manager
npm run dev
```

### مرحله 4: بررسی وضعیت

بعد از راه‌اندازی، باید این پیام‌ها را در Terminal ببینید:

```
✅ Telegram bot initialized successfully
🤖 Bot Username: @your_bot_name
📝 Bot Name: Your Bot Name
```

### مرحله 5: تست در تلگرام

1. در تلگرام به ربات خود بروید
2. دستور `/start` را بفرستید

**اگر این پیام را دیدید یعنی کار می‌کند:**
```
👋 سلام [نام]!
📋 دستورات موجود:
...
```

---

## 🔍 اگر هنوز کار نمی‌کند:

### تست Token:
```powershell
cd C:\Users\hamid\sales-mission-manager\backend
node scripts/test-telegram.js
```

این اسکریپت بررسی می‌کند که Token درست است یا نه.

### مشکلات رایج:

1. **Token اشتباه است**
   - Token را دوباره از @BotFather بگیرید
   - مطمئن شوید تمام Token را کپی کرده‌اید

2. **فایل .env در جای اشتباه است**
   - باید در پوشه `backend` باشد
   - مسیر: `backend/.env`

3. **Backend راه‌اندازی نشده**
   - مطمئن شوید Backend در حال اجرا است
   - باید `✅ Server is running on port 5000` را ببینید

4. **Token در quotes است**
   - ❌ اشتباه: `TELEGRAM_BOT_TOKEN="1234567890:ABC..."`
   - ✅ درست: `TELEGRAM_BOT_TOKEN=1234567890:ABC...`

---

## 📝 مثال کامل فایل .env:

```env
PORT=5000
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567890
SNAP_API_KEY=your-snap-api-key
```

**همه چیز آماده است - فقط Token را تنظیم کنید!** 🚀

