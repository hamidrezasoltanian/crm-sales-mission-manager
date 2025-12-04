#!/bin/bash

# اسکریپت ایجاد کاربر در MongoDB

echo "👤 ایجاد کاربر برای دیتابیس MongoDB"

# دریافت اطلاعات
read -p "آدرس سرور MongoDB را وارد کنید (یا Enter برای localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "پورت MongoDB را وارد کنید (یا Enter برای 27017): " DB_PORT
DB_PORT=${DB_PORT:-27017}

read -p "نام دیتابیس را وارد کنید (یا Enter برای sales-mission-manager): " DB_NAME
DB_NAME=${DB_NAME:-sales-mission-manager}

read -p "نام کاربری جدید را وارد کنید: " DB_USER
read -sp "رمز عبور را وارد کنید: " DB_PASS
echo ""

read -p "Auth Source را وارد کنید (یا Enter برای $DB_NAME): " AUTH_SOURCE
AUTH_SOURCE=${AUTH_SOURCE:-$DB_NAME}

# دستورات MongoDB
MONGODB_SCRIPT="
use $DB_NAME;
db.createUser({
  user: '$DB_USER',
  pwd: '$DB_PASS',
  roles: [
    { role: 'readWrite', db: '$DB_NAME' }
  ]
});
print('کاربر $DB_USER با موفقیت ایجاد شد!');
"

echo ""
echo "در حال ایجاد کاربر..."

mongosh "mongodb://$DB_HOST:$DB_PORT" --eval "$MONGODB_SCRIPT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ کاربر با موفقیت ایجاد شد!"
    echo ""
    echo "Connection String شما:"
    echo "mongodb://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?authSource=$AUTH_SOURCE"
else
    echo ""
    echo "❌ خطا در ایجاد کاربر. لطفاً بررسی کنید:"
    echo "  1. MongoDB در حال اجرا باشد"
    echo "  2. شما دسترسی admin داشته باشید"
fi
