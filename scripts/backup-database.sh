#!/bin/bash

# اسکریپت Backup از دیتابیس MongoDB

echo "💾 Backup از دیتابیس MongoDB"

# دریافت اطلاعات از .env
if [ -f "../backend/.env" ]; then
    export $(cat ../backend/.env | grep -v '^#' | xargs)
fi

# دریافت اطلاعات
read -p "آدرس سرور MongoDB را وارد کنید (یا Enter برای استفاده از .env): " DB_HOST
read -p "پورت MongoDB را وارد کنید (یا Enter برای 27017): " DB_PORT
DB_PORT=${DB_PORT:-27017}

read -p "نام دیتابیس را وارد کنید (یا Enter برای sales-mission-manager): " DB_NAME
DB_NAME=${DB_NAME:-sales-mission-manager}

read -p "مسیر ذخیره Backup را وارد کنید (یا Enter برای ./backups): " BACKUP_DIR
BACKUP_DIR=${BACKUP_DIR:-./backups}

# ایجاد پوشه backup
mkdir -p "$BACKUP_DIR"

# تاریخ و زمان برای نام فایل
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}"

echo ""
echo "در حال انجام Backup..."

# انجام backup
if [ -z "$DB_HOST" ]; then
    # استفاده از MONGODB_URI از .env
    if [ -n "$MONGODB_URI" ]; then
        mongodump --uri="$MONGODB_URI" --out="$BACKUP_FILE"
    else
        mongodump --host=localhost --port=27017 --db="$DB_NAME" --out="$BACKUP_FILE"
    fi
else
    mongodump --host="$DB_HOST" --port="$DB_PORT" --db="$DB_NAME" --out="$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    echo "✅ Backup با موفقیت انجام شد!"
    echo "📁 مسیر: $BACKUP_FILE"
    
    # فشرده‌سازی
    read -p "آیا می‌خواهید فایل را فشرده کنید؟ (y/n): " COMPRESS
    if [ "$COMPRESS" = "y" ] || [ "$COMPRESS" = "Y" ]; then
        tar -czf "${BACKUP_FILE}.tar.gz" -C "$BACKUP_DIR" "backup_${DB_NAME}_${TIMESTAMP}"
        rm -rf "$BACKUP_FILE"
        echo "✅ فایل فشرده شد: ${BACKUP_FILE}.tar.gz"
    fi
else
    echo "❌ خطا در انجام Backup"
    exit 1
fi
