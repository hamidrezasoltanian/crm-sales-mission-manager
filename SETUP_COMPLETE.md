# ✅ نصب و راه‌اندازی کامل شد!

## وضعیت پروژه

### ✅ نصب وابستگی‌ها
- ✅ Backend dependencies نصب شد
- ✅ Frontend dependencies نصب شد  
- ✅ Root dependencies نصب شد

### ✅ راه‌اندازی
- ✅ Backend در حال اجرا است (http://localhost:5000)
- ✅ Frontend در حال اجرا است (http://localhost:3000)
- ✅ SQLite database به صورت خودکار ایجاد شد

## نحوه استفاده

### دسترسی به برنامه

1. **Frontend**: باز کردن مرورگر و رفتن به:
   ```
   http://localhost:3000
   ```

2. **Backend API**: تست از طریق:
   ```
   http://localhost:5000/api/health
   ```

### دستورات مفید

#### توقف سرویس‌ها
برای توقف backend و frontend، در ترمینال‌های مربوطه `Ctrl+C` را فشار دهید.

#### اجرای مجدد

**همزمان (Backend + Frontend):**
```bash
npm run dev
```

**جداگانه:**

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

### فایل دیتابیس

دیتابیس SQLite در مسیر زیر ذخیره می‌شود:
```
backend/data/missions.db
```

برای backup، فقط این فایل را کپی کنید.

## تست API

می‌توانید API را با استفاده از curl یا Postman تست کنید:

```bash
# دریافت تمام ماموریت‌ها
curl http://localhost:5000/api/missions

# ایجاد ماموریت جدید
curl -X POST http://localhost:5000/api/missions \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"تست\",\"status\":\"pending\",\"priority\":\"medium\"}"
```

## مشکلات رایج

### Backend اجرا نمی‌شود
- بررسی کنید که پورت 5000 آزاد باشد
- بررسی کنید که node_modules نصب شده باشد
- لاگ‌های خطا را بررسی کنید

### Frontend اجرا نمی‌شود  
- بررسی کنید که پورت 3000 آزاد باشد
- بررسی کنید که node_modules نصب شده باشد
- لاگ‌های خطا را بررسی کنید

### دیتابیس ایجاد نمی‌شود
- بررسی کنید که پوشه `backend/data` قابل نوشتن است
- بررسی کنید که دسترسی‌های فایل درست است

## مراحل بعدی

1. ✅ پروژه آماده استفاده است
2. می‌توانید شروع به ایجاد ماموریت‌ها کنید
3. رابط کاربری در http://localhost:3000 در دسترس است

**موفق باشید! 🎉**
