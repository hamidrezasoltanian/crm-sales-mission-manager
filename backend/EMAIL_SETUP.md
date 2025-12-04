# 📧 راهنمای تنظیمات Email OTP

## تنظیمات SMTP

برای استفاده از Email OTP، باید تنظیمات SMTP را در فایل `.env` اضافه کنید:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

## تنظیمات برای سرویس‌های مختلف

### Gmail

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # باید App Password ایجاد کنید
SMTP_FROM=your-email@gmail.com
```

**نکته:** برای Gmail باید App Password ایجاد کنید:
1. به Google Account Settings بروید
2. Security > 2-Step Verification را فعال کنید
3. App Passwords را انتخاب کنید
4. یک App Password برای "Mail" ایجاد کنید

### Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM=your-email@outlook.com
```

### Yahoo Mail

```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@yahoo.com
```

### سرویس‌های ایرانی

#### Mail.ir

```env
SMTP_HOST=smtp.mail.ir
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@mail.ir
SMTP_PASSWORD=your-password
SMTP_FROM=your-email@mail.ir
```

#### Chmail.ir

```env
SMTP_HOST=smtp.chmail.ir
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@chmail.ir
SMTP_PASSWORD=your-password
SMTP_FROM=your-email@chmail.ir
```

## حالت Development (Test Mode)

اگر تنظیمات SMTP را وارد نکنید، سیستم از **Ethereal Email** (سرویس تست) استفاده می‌کند. در این حالت:

- ایمیل‌ها واقعاً ارسال نمی‌شوند
- یک Preview URL در console نمایش داده می‌شود
- می‌توانید ایمیل را در مرورگر مشاهده کنید

**نکته:** این حالت فقط برای تست است و در production استفاده نکنید.

## تست تنظیمات

پس از تنظیم SMTP، می‌توانید با ارسال یک OTP تست کنید:

```bash
curl -X POST http://localhost:2001/api/auth/email-otp/send \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

اگر تنظیمات درست باشد، کد OTP به ایمیل ارسال می‌شود.

## امنیت

- هرگز رمز عبور SMTP را در کد commit نکنید
- از App Passwords استفاده کنید (نه رمز اصلی)
- در production از SSL/TLS استفاده کنید (`SMTP_SECURE=true` برای پورت 465)

## محدودیت‌ها

- حداکثر 5 درخواست OTP در ساعت برای هر ایمیل
- کد OTP به مدت 5 دقیقه معتبر است
- هر کد فقط یکبار قابل استفاده است

