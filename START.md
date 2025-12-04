# 🚀 راه‌اندازی سریع پروژه

## اجرای پروژه

### روش 1: اجرای همزمان (توصیه می‌شود)

از پوشه اصلی پروژه:
```bash
npm run dev
```

این دستور هم backend و هم frontend را به صورت همزمان اجرا می‌کند.

### روش 2: اجرای جداگانه

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## دسترسی

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## اگر اپ قطع شد

### در Windows PowerShell:

```powershell
# متوقف کردن همه process های Node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# اجرای مجدد
cd C:\Users\hamid\sales-mission-manager
npm run dev
```

### یا به صورت دستی:

1. تمام پنجره‌های Terminal را ببندید
2. دوباره `npm run dev` را اجرا کنید

## بررسی وضعیت

برای بررسی اینکه آیا سرویس‌ها در حال اجرا هستند:

```powershell
# بررسی Backend
Invoke-WebRequest http://localhost:5000/api/health

# بررسی Frontend
Invoke-WebRequest http://localhost:3000
```

## مشکلات رایج

### Port در حال استفاده است
```powershell
# پیدا کردن process که از پورت استفاده می‌کند
netstat -ano | findstr :5000
netstat -ano | findstr :3000

# متوقف کردن (PID را از خروجی بالا بگیرید)
taskkill /PID <PID> /F
```

### دیتابیس قفل شده
```powershell
# پاک کردن دیتابیس و ایجاد مجدد
cd backend
Remove-Item data\missions.db -ErrorAction SilentlyContinue
node src/server.js
```
