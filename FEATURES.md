# ✅ ویژگی‌های پیاده‌سازی شده

## 📋 ساختار کامل سیستم

### 1. ✅ مدیریت پرسنل
- ایجاد، ویرایش، حذف پرسنل
- نقش‌ها: Admin, Manager, Staff
- اتصال با Telegram ID
- شماره تماس یکتا

### 2. ✅ مدیریت مراکز
- ایجاد، ویرایش، حذف مراکز
- ذخیره لوکیشن (latitude, longitude)
- اتصال با اسنپ (snapLocationId)
- شهر و منطقه

### 3. ✅ مدیریت ماموریت‌ها (Assignments)
- اختصاص مرکز به پرسنل
- وضعیت: pending, approved, in-progress, completed, rejected, cancelled
- تایید توسط مدیر
- لوکیشن از اسنپ
- محاسبه هزینه خودکار
- کد تخفیف
- مبلغ پرداخت شخصی

### 4. ✅ کدهای تخفیف
- ایجاد کد تخفیف
- دو نوع: درصدی (percentage) و ثابت (fixed)
- محدودیت تعداد استفاده
- محدودیت زمانی (validFrom, validUntil)
- ردیابی استفاده

### 5. ✅ گزارش‌سازی
- گزارش کلی (خلاصه)
- گزارش بر اساس پرسنل
- گزارش بر اساس مرکز
- گزارش بر اساس کد تخفیف
- گزارش جزئیات با فیلترهای مختلف:
  - بر اساس پرسنل
  - بر اساس مرکز
  - بر اساس وضعیت
  - بر اساس کد تخفیف
  - بر اساس تاریخ (startDate, endDate)

### 6. ✅ اتصال با اسنپ
- سرویس برای دریافت لوکیشن
- محاسبه هزینه سفر
- ذخیره اطلاعات لوکیشن در ماموریت

### 7. ✅ ربات تلگرام
- دستورات:
  - `/start` - شروع کار با ربات
  - `/missions` - لیست ماموریت‌های کاربر
  - `/pending` - ماموریت‌های در انتظار (فقط مدیران)
  - `/approve_<id>` - تایید ماموریت (فقط مدیران)
  - `/status <id>` - وضعیت ماموریت
  - `/help` - راهنما
- اطلاع‌رسانی خودکار:
  - هنگام ایجاد ماموریت جدید
  - هنگام تایید ماموریت

## 🔌 API Endpoints

### پرسنل (`/api/personnel`)
- `GET /api/personnel` - لیست تمام پرسنل
- `GET /api/personnel/:id` - دریافت یک پرسنل
- `GET /api/personnel/phone/:phone` - دریافت بر اساس شماره تماس
- `GET /api/personnel/telegram/:telegramId` - دریافت بر اساس Telegram ID
- `POST /api/personnel` - ایجاد پرسنل جدید
- `PUT /api/personnel/:id` - به‌روزرسانی پرسنل
- `DELETE /api/personnel/:id` - حذف پرسنل

### مراکز (`/api/centers`)
- `GET /api/centers` - لیست تمام مراکز
- `GET /api/centers/:id` - دریافت یک مرکز
- `POST /api/centers` - ایجاد مرکز جدید
- `PUT /api/centers/:id` - به‌روزرسانی مرکز
- `DELETE /api/centers/:id` - حذف مرکز

### ماموریت‌ها (`/api/assignments`)
- `GET /api/assignments` - لیست تمام ماموریت‌ها (با فیلتر)
- `GET /api/assignments/:id` - دریافت یک ماموریت
- `POST /api/assignments` - ایجاد ماموریت جدید
- `POST /api/assignments/:id/approve` - تایید ماموریت (نیاز به managerId)
- `PATCH /api/assignments/:id/status` - تغییر وضعیت
- `PUT /api/assignments/:id` - به‌روزرسانی ماموریت
- `DELETE /api/assignments/:id` - حذف ماموریت

### گزارش‌ها (`/api/reports`)
- `GET /api/reports/summary` - گزارش کلی
- `GET /api/reports/by-personnel` - گزارش بر اساس پرسنل
- `GET /api/reports/by-center` - گزارش بر اساس مرکز
- `GET /api/reports/by-discount` - گزارش بر اساس کد تخفیف
- `GET /api/reports/details` - گزارش جزئیات با فیلتر

### کدهای تخفیف (`/api/discount-codes`)
- `GET /api/discount-codes` - لیست تمام کدها
- `GET /api/discount-codes/:id` - دریافت یک کد
- `GET /api/discount-codes/code/:code` - دریافت بر اساس کد
- `POST /api/discount-codes` - ایجاد کد جدید
- `PUT /api/discount-codes/:id` - به‌روزرسانی کد
- `DELETE /api/discount-codes/:id` - حذف کد

## 📊 محاسبات هزینه

سیستم به صورت خودکار محاسبه می‌کند:
1. **هزینه اسنپ** (snapCost) - از API اسنپ یا ورودی دستی
2. **مقدار تخفیف** (discountAmount) - بر اساس کد تخفیف:
   - درصدی: `(snapCost * discountValue) / 100`
   - ثابت: `discountValue`
3. **هزینه کل** (totalCost) - `snapCost - discountAmount`
4. **پرداخت شخصی** (personalPayment) - توسط مدیر تعیین می‌شود

## 🔐 امنیت و دسترسی

- تایید ماموریت فقط توسط مدیران (admin, manager)
- بررسی نقش کاربر در API
- اعتبارسنجی کدهای تخفیف (تاریخ، تعداد استفاده)

## 📝 یادداشت‌ها

### اسنپ API
سرویس اسنپ به صورت نمونه پیاده‌سازی شده است. برای استفاده واقعی باید:
1. API Key از اسنپ دریافت شود
2. Endpoint های واقعی اسنپ در `snapService.js` تنظیم شوند
3. فرمت داده‌ها با API واقعی هماهنگ شود

### ربات تلگرام
برای فعال شدن ربات:
1. ربات را از @BotFather در تلگرام بسازید
2. Token را دریافت کنید
3. Token را در `.env` قرار دهید: `TELEGRAM_BOT_TOKEN=your-token`
4. پرسنل را با Telegram ID ثبت کنید

### دیتابیس
دیتابیس SQLite به صورت خودکار در `backend/data/missions.db` ایجاد می‌شود.

---

**تمام ویژگی‌های درخواستی پیاده‌سازی شده است!** 🎉
