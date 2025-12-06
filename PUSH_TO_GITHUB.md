# راهنمای آپلود به GitHub

## مشکل احراز هویت

برای آپلود کد به GitHub، نیاز به احراز هویت دارید. دو روش وجود دارد:

## روش 1: استفاده از Personal Access Token (پیشنهادی)

### مرحله 1: ایجاد Token در GitHub

1. به https://github.com/settings/tokens بروید
2. روی **"Generate new token"** > **"Generate new token (classic)"** کلیک کنید
3. یک نام برای token انتخاب کنید (مثلاً: `crm-upload`)
4. Scope های زیر را انتخاب کنید:
   - ✅ `repo` (Full control of private repositories)
5. روی **"Generate token"** کلیک کنید
6. **Token را کپی کنید** (فقط یک بار نمایش داده می‌شود!)

### مرحله 2: آپلود با Token

بعد از ایجاد token، این دستور را اجرا کنید:

```bash
cd /home/hamidreza/App/sales-mission-manager
git push -u origin main
```

وقتی از شما Username خواست:
- **Username:** `hamidrezasoltanian`
- **Password:** token را که کپی کردید وارد کنید (نه رمز عبور GitHub!)

## روش 2: استفاده از SSH (برای استفاده دائمی)

### مرحله 1: ایجاد SSH Key

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# Enter را بزنید (برای استفاده از مسیر پیش‌فرض)
# یک passphrase انتخاب کنید (اختیاری)
```

### مرحله 2: اضافه کردن SSH Key به GitHub

```bash
# نمایش کلید عمومی
cat ~/.ssh/id_ed25519.pub
```

1. خروجی را کپی کنید
2. به https://github.com/settings/keys بروید
3. روی **"New SSH key"** کلیک کنید
4. Title: `CRM Project`
5. Key: کلید کپی شده را paste کنید
6. **"Add SSH key"** را بزنید

### مرحله 3: تغییر remote به SSH

```bash
cd /home/hamidreza/App/sales-mission-manager
git remote set-url origin git@github.com:hamidrezasoltanian/crm-sales-mission-manager.git
git push -u origin main
```

## وضعیت فعلی

✅ Repository Git آماده است
✅ تمام فایل‌ها commit شده‌اند
✅ Remote origin تنظیم شده است
⏳ منتظر احراز هویت برای push

## دستورات آماده

```bash
cd /home/hamidreza/App/sales-mission-manager
git push -u origin main
```

