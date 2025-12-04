#!/bin/bash

# اسکریپت Restore دیتابیس MongoDB

echo "🔄 Restore دیتابیس MongoDB"

# دریافت اطلاعات
read -p "آدرس سرور MongoDB را وارد کنید (یا Enter برای localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "پورت MongoDB را وارد کنید (یا Enter برای 27017): " DB_PORT
DB_PORT=${DB_PORT:-27017}

read -p "نام دیتابیس را وارد کنید (یا Enter برای sales-mission-manager): " DB_NAME
DB_NAME=${DB_NAME:-sales-mission-manager}

read -p "مسیر فایل Backup را وارد کنید: " BACKUP_PATH

# بررسی وجود فایل
if [ ! -d "$BACKUP_PATH" ] && [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ فایل یا پوشه Backup پیدا نشد!"
    exit 1
fi

# اگر فایل فشرده است، باز کردن
if [[ "$BACKUP_PATH" == *.tar.gz ]] || [[ "$BACKUP_PATH" == *.tgz ]]; then
    echo "📦 در حال باز کردن فایل فشرده..."
    TEMP_DIR=$(mktemp -d)
    tar -xzf "$BACKUP_PATH" -C "$TEMP_DIR"
    BACKUP_PATH="$TEMP_DIR"
fi

echo ""
echo "⚠️  هشدار: این عملیات تمام داده‌های موجود در دیتابیس $DB_NAME را جایگزین می‌کند!"
read -p "آیا مطمئن هستید؟ (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ عملیات لغو شد."
    exit 0
fi

echo ""
echo "در حال انجام Restore..."

# انجام restore
mongorestore --host="$DB_HOST" --port="$DB_PORT" --db="$DB_NAME" "$BACKUP_PATH/$DB_NAME" 2>/dev/null || \
mongorestore --host="$DB_HOST" --port="$DB_PORT" --db="$DB_NAME" "$BACKUP_PATH" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Restore با موفقیت انجام شد!"
else
    echo "❌ خطا در انجام Restore"
    exit 1
fi

# پاک کردن پوشه موقت
if [ -n "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi
