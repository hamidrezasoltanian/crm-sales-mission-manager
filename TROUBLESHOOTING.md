# راهنمای عیب‌یابی

## مشکل: AxiosError در Frontend

### علت:
- Backend در حال اجرا نیست
- یا دیتابیس جداول جدید را ندارد
- یا route ها به درستی لود نشده‌اند

### راه‌حل:

#### 1. بررسی اجرای Backend
```bash
cd backend
node src/server.js
```

باید پیام‌های زیر را ببینید:
```
✅ SQLite database loaded successfully
✅ جداول دیتابیس آماده شدند
✅ Database ready
✅ Server is running on port 5000
```

#### 2. تست API مستقیماً
در مرورگر یا Postman:
```
GET http://localhost:5000/api/health
GET http://localhost:5000/api/personnel
```

#### 3. پاک کردن و ایجاد مجدد دیتابیس
```bash
cd backend
Remove-Item data\missions.db -ErrorAction SilentlyContinue
node src/server.js
```

این کار دیتابیس را پاک می‌کند و جداول جدید را ایجاد می‌کند.

#### 4. بررسی فایل .env
مطمئن شوید که فایل `.env` در پوشه `backend` وجود دارد:
```env
PORT=5000
```

### تست کردن:

1. **تست Health Endpoint:**
```powershell
Invoke-WebRequest http://localhost:5000/api/health
```

2. **تست Personnel Endpoint:**
```powershell
Invoke-WebRequest http://localhost:5000/api/personnel
```

3. **اگر خطا داد، لاگ‌های backend را بررسی کنید**

### نکات مهم:

- مطمئن شوید که backend و frontend هر دو در حال اجرا هستند
- Backend باید روی پورت 5000 اجرا شود
- Frontend باید روی پورت 3000 اجرا شود
- اگر دیتابیس قدیمی دارید، سیستم به صورت خودکار migration می‌کند

## اگر هنوز مشکل دارید:

1. تمام process های node را متوقف کنید
2. دیتابیس را پاک کنید
3. Backend را دوباره اجرا کنید
4. Frontend را دوباره اجرا کنید
