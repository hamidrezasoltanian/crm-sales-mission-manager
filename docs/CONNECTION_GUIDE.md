# راهنمای اتصال به MongoDB روی سرور

## انواع اتصال

### 1. اتصال محلی (Local)

```env
MONGODB_URI=mongodb://localhost:27017/sales-mission-manager
```

### 2. اتصال به سرور راه‌دور (بدون Authentication)

```env
MONGODB_URI=mongodb://your-server-ip:27017/sales-mission-manager
```

**مثال:**
```env
MONGODB_URI=mongodb://192.168.1.100:27017/sales-mission-manager
```

### 3. اتصال با Authentication

```env
MONGODB_URI=mongodb://username:password@your-server-ip:27017/sales-mission-manager?authSource=database-name
```

**مثال:**
```env
MONGODB_URI=mongodb://sales-user:MySecurePass123@192.168.1.100:27017/sales-mission-manager?authSource=sales-mission-manager
```

### 4. اتصال با SSL/TLS

```env
MONGODB_URI=mongodb://username:password@your-server-ip:27017/sales-mission-manager?ssl=true&authSource=database-name
```

## تنظیمات Firewall برای سرور

### Ubuntu/Debian (UFW)

```bash
# اجازه دسترسی از IP مشخص
sudo ufw allow from YOUR_CLIENT_IP to any port 27017

# بررسی وضعیت
sudo ufw status
```

### CentOS/RHEL (Firewalld)

```bash
# اجازه دسترسی از IP مشخص
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="YOUR_CLIENT_IP" port port="27017" protocol="tcp" accept'

# اعمال تغییرات
sudo firewall-cmd --reload
```

## تست اتصال

### استفاده از اسکریپت تست

```bash
cd backend
node ../scripts/test-connection.js
```

### استفاده از mongosh (MongoDB Shell)

```bash
# بدون Authentication
mongosh "mongodb://your-server-ip:27017/sales-mission-manager"

# با Authentication
mongosh "mongodb://username:password@your-server-ip:27017/sales-mission-manager?authSource=database-name"
```

## ایجاد فایل .env

1. در پوشه `backend` فایل `.env` را ایجاد کنید:

```bash
cd backend
cp .env.example .env
```

2. فایل `.env` را ویرایش کنید و اطلاعات اتصال را وارد کنید:

```env
PORT=5000
MONGODB_URI=mongodb://username:password@your-server-ip:27017/sales-mission-manager?authSource=sales-mission-manager
```

## عیب‌یابی مشکلات رایج

### مشکل: ECONNREFUSED

**علت:** MongoDB در حال اجرا نیست یا پورت اشتباه است.

**راه‌حل:**
```bash
# بررسی وضعیت MongoDB
sudo systemctl status mongod

# شروع MongoDB
sudo systemctl start mongod
```

### مشکل: Timeout

**علت:** Firewall یا MongoDB به درستی پیکربندی نشده.

**راه‌حل:**
1. بررسی تنظیمات Firewall
2. بررسی `bindIp` در `/etc/mongod.conf`
3. بررسی اینکه IP سرور صحیح است

### مشکل: Authentication failed

**علت:** نام کاربری یا رمز عبور اشتباه است.

**راه‌حل:**
1. بررسی نام کاربری و رمز عبور
2. بررسی `authSource`
3. بررسی اینکه کاربر در دیتابیس درست ایجاد شده

### مشکل: Network is unreachable

**علت:** آدرس IP یا DNS اشتباه است.

**راه‌حل:**
```bash
# تست دسترسی به سرور
ping your-server-ip

# تست دسترسی به پورت
telnet your-server-ip 27017
# یا
nc -zv your-server-ip 27017
```

## امنیت

### توصیه‌های امنیتی:

1. **همیشه از Authentication استفاده کنید** برای اتصال‌های راه‌دور
2. **Firewall را محدود کنید** به IP های مورد نیاز
3. **از رمزهای عبور قوی استفاده کنید**
4. **در صورت امکان از SSL/TLS استفاده کنید**
5. **به طور منظم backup بگیرید**

### مثال تنظیمات امن

```yaml
# /etc/mongod.conf
net:
  bindIp: 127.0.0.1,your-server-internal-ip  # فقط IP داخلی سرور

security:
  authorization: enabled
```

و استفاده از SSH Tunnel برای اتصال امن:

```bash
ssh -L 27017:localhost:27017 user@your-server-ip
```

سپس از localhost استفاده کنید:

```env
MONGODB_URI=mongodb://localhost:27017/sales-mission-manager
```
