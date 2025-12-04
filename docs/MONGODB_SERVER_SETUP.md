# راهنمای راه‌اندازی MongoDB روی سرور

این راهنما به شما کمک می‌کند تا MongoDB را روی سرور خودتان نصب و راه‌اندازی کنید.

## نصب MongoDB روی Ubuntu/Debian

### 1. وارد شدن به سرور

```bash
ssh user@your-server-ip
```

### 2. به‌روزرسانی سیستم

```bash
sudo apt update
sudo apt upgrade -y
```

### 3. نصب MongoDB

```bash
# وارد کردن کلید GPG
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# اضافه کردن repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# به‌روزرسانی و نصب
sudo apt update
sudo apt install -y mongodb-org
```

### 4. راه‌اندازی MongoDB

```bash
# شروع سرویس
sudo systemctl start mongod

# فعال کردن سرویس برای راه‌اندازی خودکار
sudo systemctl enable mongod

# بررسی وضعیت
sudo systemctl status mongod
```

## نصب MongoDB روی CentOS/RHEL

### 1. ایجاد فایل repository

```bash
sudo vi /etc/yum.repos.d/mongodb-org-7.0.repo
```

محتوای زیر را اضافه کنید:

```ini
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
```

### 2. نصب و راه‌اندازی

```bash
sudo yum install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```

## پیکربندی MongoDB برای دسترسی از راه دور

### 1. ویرایش فایل پیکربندی

```bash
sudo vi /etc/mongod.conf
```

### 2. تغییر تنظیمات شبکه

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

### 3. راه‌اندازی مجدد MongoDB

```bash
sudo systemctl restart mongod
```

## تنظیمات Firewall

### برای UFW (Ubuntu/Debian):

```bash
sudo ufw allow from your-client-ip to any port 27017
# یا برای همه IP ها (کمتر امن)
sudo ufw allow 27017/tcp
```

### برای Firewalld (CentOS/RHEL):

```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="your-client-ip" port port="27017" protocol="tcp" accept'
# یا برای همه
sudo firewall-cmd --permanent --add-port=27017/tcp
sudo firewall-cmd --reload
```

## ایجاد کاربر و تنظیمات Authentication

### 1. اتصال به MongoDB

```bash
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

// خروج
exit
```

### 4. فعال کردن Authentication

ویرایش فایل `/etc/mongod.conf`:

```yaml
security:
  authorization: enabled
```

راه‌اندازی مجدد:

```bash
sudo systemctl restart mongod
```

## تست اتصال

از سرور محلی:

```bash
mongosh "mongodb://sales-mission-user:your-password@your-server-ip:27017/sales-mission-manager?authSource=sales-mission-manager"
```

## اتصال با SSL/TLS (اختیاری - توصیه می‌شود)

برای اتصال امن‌تر، می‌توانید SSL/TLS را فعال کنید. این نیاز به تنظیمات اضافی دارد که در مستندات MongoDB موجود است.

## نکات امنیتی مهم

1. **هرگز MongoDB را بدون Authentication در دسترس اینترنت قرار ندهید**
2. **از firewall برای محدود کردن دسترسی استفاده کنید**
3. **از رمزهای عبور قوی استفاده کنید**
4. **به طور منظم backup بگیرید**
5. **فقط IP های مورد نیاز را به firewall اضافه کنید**
