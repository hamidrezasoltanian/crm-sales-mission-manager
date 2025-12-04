#!/bin/bash

# اسکریپت راه‌اندازی اولیه دیتابیس MongoDB

echo "🚀 راه‌اندازی دیتابیس MongoDB برای Sales Mission Manager"

# رنگ‌ها برای خروجی
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# دریافت اطلاعات از کاربر
read -p "آدرس سرور MongoDB را وارد کنید (یا Enter برای localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "پورت MongoDB را وارد کنید (یا Enter برای 27017): " DB_PORT
DB_PORT=${DB_PORT:-27017}

read -p "نام دیتابیس را وارد کنید (یا Enter برای sales-mission-manager): " DB_NAME
DB_NAME=${DB_NAME:-sales-mission-manager}

read -p "آیا از Authentication استفاده می‌کنید؟ (y/n): " USE_AUTH

if [ "$USE_AUTH" = "y" ] || [ "$USE_AUTH" = "Y" ]; then
    read -p "نام کاربری را وارد کنید: " DB_USER
    read -sp "رمز عبور را وارد کنید: " DB_PASS
    echo ""
    read -p "Auth Source را وارد کنید (یا Enter برای $DB_NAME): " AUTH_SOURCE
    AUTH_SOURCE=${AUTH_SOURCE:-$DB_NAME}
    
    CONNECTION_STRING="mongodb://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?authSource=$AUTH_SOURCE"
else
    CONNECTION_STRING="mongodb://$DB_HOST:$DB_PORT/$DB_NAME"
fi

echo ""
echo -e "${YELLOW}در حال تست اتصال...${NC}"

# تست اتصال
mongosh "$CONNECTION_STRING" --eval "db.adminCommand('ping')" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ اتصال موفق بود!${NC}"
    echo ""
    echo "برای استفاده، فایل .env را در پوشه backend ایجاد کنید:"
    echo ""
    echo "MONGODB_URI=$CONNECTION_STRING"
    echo ""
    
    # ایجاد فایل .env
    read -p "آیا می‌خواهید فایل .env به صورت خودکار ایجاد شود؟ (y/n): " CREATE_ENV
    if [ "$CREATE_ENV" = "y" ] || [ "$CREATE_ENV" = "Y" ]; then
        echo "MONGODB_URI=$CONNECTION_STRING" > ../backend/.env
        echo "PORT=5000" >> ../backend/.env
        echo -e "${GREEN}✓ فایل .env ایجاد شد!${NC}"
    fi
else
    echo -e "${YELLOW}⚠ اتصال ناموفق بود. لطفاً بررسی کنید:${NC}"
    echo "  1. MongoDB در حال اجرا باشد"
    echo "  2. آدرس و پورت صحیح باشد"
    echo "  3. Firewall تنظیمات صحیح داشته باشد"
    echo "  4. نام کاربری و رمز عبور صحیح باشد (در صورت استفاده از Authentication)"
fi
