# CRM Sales Mission Manager System

یک سیستم کامل مدیریت ماموریت‌های فروش با قابلیت‌های پیشرفته CRM

## ویژگی‌ها

- ✅ مدیریت کامل پرسنل و کاربران
- ✅ سیستم مدیریت ماموریت‌های فروش
- ✅ داشبورد تحلیلی با نمودارها و آمار
- ✅ مدیریت مراکز و مشتریان
- ✅ سیستم مدیریت کارها (Workflow/Kanban)
- ✅ ربات تلگرام برای دسترسی سریع
- ✅ سیستم مدیریت فایل‌های پزشکی
- ✅ مدیریت مرخصی و حضور و غیاب
- ✅ گزارش‌گیری پیشرفته
- ✅ احراز هویت و مدیریت دسترسی

## تکنولوژی‌ها

### Backend
- Node.js + Express.js
- SQLite Database
- Telegram Bot API
- JWT Authentication

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Recharts (نمودارها)

## نصب و راه‌اندازی

### پیش‌نیازها
- Node.js 18+
- npm یا yarn
- PM2 (برای production)

### نصب

```bash
# نصب dependencies
cd backend && npm install
cd ../frontend && npm install

# تنظیم متغیرهای محیطی
cp backend/env.example backend/.env
# فایل .env را ویرایش کنید و مقادیر را تنظیم کنید
```

### راه‌اندازی

```bash
# Development
cd backend && npm run dev
cd frontend && npm run dev

# Production با PM2
pm2 start ecosystem.config.js
pm2 save
```

## ساختار پروژه

```
sales-mission-manager/
├── backend/          # Backend API
│   ├── src/
│   │   ├── routes/   # API routes
│   │   ├── models/   # Database models
│   │   ├── controllers/
│   │   └── services/ # Business logic
│   └── data/         # Database files
├── frontend/         # Next.js frontend
│   ├── app/          # App router pages
│   ├── components/  # React components
│   └── lib/          # Utilities
└── scripts/          # Deployment scripts
```

## پورت‌ها

- Frontend: `http://localhost:2000`
- Backend API: `http://localhost:2001`
- Telegram Bot: پیکربندی در `.env`

## مستندات

برای اطلاعات بیشتر به فایل‌های زیر مراجعه کنید:
- `HOW_TO_ADD_USER.md` - راهنمای اضافه کردن کاربر
- `docs/` - مستندات کامل
- `FEATURES.md` - لیست کامل ویژگی‌ها

## مجوز

این پروژه برای استفاده داخلی شرکت توسعه یافته است.

## نویسنده

Hamidreza Soltanian
