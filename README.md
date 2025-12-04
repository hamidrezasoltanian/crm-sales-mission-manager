# Sales Mission Manager

یک سیستم مدیریت ماموریت‌های فروش با استفاده از Node.js، Express، SQLite و Next.js

## ویژگی‌ها

- ایجاد و مدیریت ماموریت‌های فروش
- تعیین اولویت و وضعیت برای هر ماموریت
- واگذاری ماموریت به افراد
- تعیین تاریخ سررسید
- رابط کاربری مدرن و واکنش‌گرا
- **دیتابیس SQLite رایگان و بدون نیاز به سرور جداگانه**

## نصب و راه‌اندازی

### پیش‌نیازها

- Node.js (v18 یا بالاتر)
- **هیچ دیتابیس جداگانه‌ای نیاز نیست!** SQLite به صورت خودکار نصب و راه‌اندازی می‌شود

### نصب

1. نصب تمام وابستگی‌ها:
```bash
npm run install:all
```

2. تنظیم متغیرهای محیطی (اختیاری):

برای backend، فایل `.env` را در پوشه `backend` ایجاد کنید:
```bash
cd backend
cp env.example .env
```

فایل `.env` را می‌توانید ویرایش کنید (اختیاری):
```
PORT=5000
# DB_PATH=./data  # مسیر دیتابیس (پیش‌فرض: backend/data/missions.db)
```

> 💡 **نکته:** SQLite به صورت خودکار دیتابیس را در `backend/data/missions.db` ایجاد می‌کند. نیاز به تنظیمات اضافی نیست!

برای frontend، فایل `.env.local` را در پوشه `frontend` ایجاد کنید (اختیاری):
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### اجرا

اجرای همزمان backend و frontend:
```bash
npm run dev
```

یا به صورت جداگانه:

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

## استفاده

- Backend API در `http://localhost:5000` اجرا می‌شود
- Frontend در `http://localhost:3000` اجرا می‌شود
- دیتابیس SQLite به صورت خودکار در `backend/data/missions.db` ایجاد می‌شود

## مزایای SQLite

✅ **رایگان و بدون محدودیت**  
✅ **نیاز به نصب و راه‌اندازی سرور جداگانه ندارد**  
✅ **فایل‌محور - ساده برای backup**  
✅ **عملکرد عالی برای پروژه‌های کوچک تا متوسط**  
✅ **پشتیبانی کامل از ACID**  

## API Endpoints

- `GET /api/missions` - دریافت تمام ماموریت‌ها
- `GET /api/missions/:id` - دریافت یک ماموریت
- `POST /api/missions` - ایجاد ماموریت جدید
- `PUT /api/missions/:id` - به‌روزرسانی ماموریت
- `DELETE /api/missions/:id` - حذف ماموریت
- `GET /api/health` - بررسی وضعیت سرور

## Backup دیتابیس

برای backup، فقط فایل `backend/data/missions.db` را کپی کنید:

```bash
# Windows
copy backend\data\missions.db backup\missions_backup.db

# Linux/Mac
cp backend/data/missions.db backup/missions_backup.db
```

## گزینه‌های دیتابیس دیگر

اگر می‌خواهید از دیتابیس ابری رایگان استفاده کنید:

### Supabase (PostgreSQL - رایگان)

Supabase یک جایگزین رایگان و عالی برای MongoDB است که شامل:
- 500MB فضای رایگان
- PostgreSQL با API REST آماده
- Authentication داخلی
- Real-time subscriptions

برای استفاده از Supabase، به `docs/SUPABASE_SETUP.md` مراجعه کنید.

## ساختار پروژه

```
sales-mission-manager/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js    # تنظیمات SQLite
│   │   ├── models/
│   │   │   └── Mission.js     # مدل Mission با SQLite
│   │   ├── routes/
│   │   │   └── missions.js    # API routes
│   │   └── server.js
│   ├── data/                  # دیتابیس SQLite در اینجا ذخیره می‌شود
│   │   └── missions.db        # فایل دیتابیس (خودکار ایجاد می‌شود)
│   ├── env.example
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── components/
│   │   │   ├── MissionList.tsx
│   │   │   └── MissionForm.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   └── package.json
└── package.json
```

## تکنولوژی‌ها

- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Other**: Axios برای درخواست‌های HTTP

## عیب‌یابی

### مشکل: Cannot find module 'better-sqlite3'

**راه‌حل:**
```bash
cd backend
npm install
```

### مشکل: دیتابیس ایجاد نمی‌شود

**راه‌حل:** مطمئن شوید که پوشه `backend/data` قابل نوشتن است. در صورت نیاز، دسترسی‌ها را بررسی کنید.

## انتقال به دیتابیس دیگر

اگر می‌خواهید بعداً به PostgreSQL، MySQL یا MongoDB منتقل کنید، کد به گونه‌ای نوشته شده که می‌توانید به راحتی مدل‌ها را تغییر دهید.