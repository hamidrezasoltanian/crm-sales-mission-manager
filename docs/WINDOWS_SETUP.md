# راهنمای نصب MongoDB روی Windows Server

این راهنما به شما کمک می‌کند تا MongoDB را روی Windows Server نصب و راه‌اندازی کنید.

## نصب MongoDB روی Windows

### 1. دانلود MongoDB

1. به آدرس https://www.mongodb.com/try/download/community بروید
2. نسخه Windows را انتخاب کنید
3. MongoDB Community Server را دانلود کنید

### 2. نصب

1. فایل installer را اجرا کنید
2. گزینه "Complete" را انتخاب کنید
3. گزینه "Install MongoDB as a Service" را انتخاب کنید
4. Service Name را به `MongoDB` تنظیم کنید
5. نصب را تکمیل کنید

### 3. بررسی نصب

باز کردن Command Prompt یا PowerShell به عنوان Administrator:

```powershell
# بررسی سرویس
Get-Service MongoDB

# شروع سرویس (در صورت نیاز)
Start-Service MongoDB

# بررسی وضعیت
Get-Service MongoDB
```

### 4. تست اتصال

```powershell
# اجرای MongoDB Shell
mongosh

# یا تست اتصال
mongosh "mongodb://localhost:27017"
```

## پیکربندی برای دسترسی از راه دور

### 1. ویرایش فایل پیکربندی

فایل پیکربندی معمولاً در مسیر زیر است:
```
C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg
```

یا در مسیر نصب MongoDB شما.

### 2. ویرایش تنظیمات

فایل `mongod.cfg` را با ویرایشگر متن (با دسترسی Administrator) باز کنید:

```yaml
net:
  port: 27017
  bindIp: 0.0.0.0  # اجازه اتصال از هر IP
```

**یا برای امنیت بیشتر:**

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,your-server-ip  # فقط IP سرور و localhost
```

### 3. راه‌اندازی مجدد سرویس

```powershell
# به عنوان Administrator
Restart-Service MongoDB
```

## تنظیمات Windows Firewall

### از طریق PowerShell (به عنوان Administrator):

```powershell
# اجازه دسترسی از IP مشخص
New-NetFirewallRule -DisplayName "MongoDB" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Allow -RemoteAddress "YOUR_CLIENT_IP"

# یا برای همه IP ها (کمتر امن)
New-NetFirewallRule -DisplayName "MongoDB" -Direction Inbound -LocalPort 27017 -Protocol TCP -Action Allow
```

### از طریق رابط گرافیکی:

1. Windows Defender Firewall را باز کنید
2. Advanced settings را انتخاب کنید
3. Inbound Rules > New Rule
4. Port > Next
5. TCP و Port: 27017 > Next
6. Allow the connection > Next
7. Domain, Private, Public را انتخاب کنید > Next
8. نام را "MongoDB" بگذارید > Finish

## ایجاد کاربر و تنظیمات Authentication

### 1. اتصال به MongoDB

```powershell
mongosh
```

### 2. ایجاد ادمین اصلی

```javascript
use admin
db.createUser({
  user: "admin",
  pwd: "your-strong-password-here",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})
```

### 3. ایجاد دیتابیس و کاربر برای پروژه

```javascript
use sales-mission-manager

db.createUser({
  user: "sales-mission-user",
  pwd: "your-secure-password-here",
  roles: [
    { role: "readWrite", db: "sales-mission-manager" }
  ]
})

exit
```

### 4. فعال کردن Authentication

ویرایش فایل `mongod.cfg`:

```yaml
security:
  authorization: enabled
```

راه‌اندازی مجدد سرویس:

```powershell
Restart-Service MongoDB
```

## تست اتصال

از کامپیوتر محلی:

```powershell
mongosh "mongodb://sales-mission-user:your-password@localhost:27017/sales-mission-manager?authSource=sales-mission-manager"
```

از کامپیوتر دیگر:

```powershell
mongosh "mongodb://sales-mission-user:your-password@your-server-ip:27017/sales-mission-manager?authSource=sales-mission-manager"
```

## استفاده از اسکریپت تست اتصال

در پروژه شما، می‌توانید از اسکریپت PowerShell استفاده کنید:

```powershell
cd C:\Users\hamid\sales-mission-manager
.\scripts\test-connection.ps1
```

## نکات امنیتی مهم

1. **همیشه از Authentication استفاده کنید** برای اتصال‌های راه‌دور
2. **Firewall را محدود کنید** به IP های مورد نیاز
3. **از رمزهای عبور قوی استفاده کنید**
4. **به طور منظم backup بگیرید**
5. **فقط IP های مورد نیاز را به firewall اضافه کنید**
6. **از SSL/TLS استفاده کنید** برای اتصال‌های حساس

## مدیریت سرویس MongoDB

```powershell
# شروع سرویس
Start-Service MongoDB

# توقف سرویس
Stop-Service MongoDB

# راه‌اندازی مجدد
Restart-Service MongoDB

# بررسی وضعیت
Get-Service MongoDB

# مشاهده لاگ‌ها
Get-Content "C:\Program Files\MongoDB\Server\<version>\log\mongod.log" -Tail 50
```

## مسیرهای مهم

- **فایل پیکربندی**: `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`
- **داده‌ها**: `C:\Program Files\MongoDB\Server\<version>\data\db` (پیش‌فرض)
- **لاگ‌ها**: `C:\Program Files\MongoDB\Server\<version>\log\mongod.log`
- **اجرایی**: `C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe`
