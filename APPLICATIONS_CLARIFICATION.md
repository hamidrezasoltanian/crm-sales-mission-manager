# 🔍 توضیح اپلیکیشن‌ها و Migration

## 📱 اپلیکیشن‌های موجود

### 1. اپلیکیشن مدیریت ماموریت (Sales Mission Manager)
- **مسیر:** `/home/hamidreza/App/sales-mission-manager`
- **Frontend:** پورت 2000
- **Backend:** پورت 2001
- **دیتابیس قدیم:** `backend/data/missions.db` (sql.js)
- **وضعیت Migration:** ✅ انجام شد

### 2. EZ Dashboard (آنالیز فروش)
- **مسیر:** `/home/hamidreza/App/ez-dashboard`
- **Frontend:** پورت 5173 (Vite)
- **Backend:** پورت 9001 (طبق vite.config.ts)
- **دیتابیس قدیم:** `database/ez_dashboard.db` (sqlite3)
- **وضعیت Migration:** ✅ انجام شد

---

## ❓ سوال شما

شما پرسیدید که آیا دیتابیس مشترک را بین:
1. **اپ آنالیز فروش روی پورت 5000** ❓
2. **EZ Dashboard روی پورت 5173** ✅
3. **اپ ماموریت روی پورت 2000** ✅

---

## ✅ پاسخ

**بله، دیتابیس مشترک را بین این دو اپلیکیشن درست کردم:**

1. ✅ **EZ Dashboard** (آنالیز فروش) - روی پورت 5173
   - دیتابیس: `ez_dashboard.db`
   - داده‌های migrate شده: products, orders, proformas, workflows, activities

2. ✅ **اپلیکیشن مدیریت ماموریت** - روی پورت 2000
   - دیتابیس: `missions.db`
   - داده‌های migrate شده: personnel, centers, assignments, contacts, discount_codes

---

## ⚠️ نکته مهم

**در مورد پورت 5000:**
- من در کدها پورت 5000 را برای اپلیکیشن آنالیز فروش پیدا نکردم
- EZ Dashboard روی پورت **5173** (frontend) و **9001** (backend) اجرا می‌شود
- ممکن است یک اپلیکیشن دیگر روی پورت 5000 وجود داشته باشد که من از آن اطلاع ندارم

---

## 📊 دیتابیس مشترک

**دیتابیس مشترک ایجاد شده:**
- **مسیر:** `/home/hamidreza/App/sales-mission-manager/backend/data/shared.db`
- **جداول مشترک:**
  - `personnel` (کارمندان)
  - `centers` (مراکز)
  - `center_personnel` (پرسنل مرکز)
  - `organization_positions` (پست‌های سازمانی)

**جداول mission_*:**
- `mission_assignments`
- `mission_contacts`
- `mission_discount_codes`
- `mission_audit_logs`

**جداول analysis_*:**
- `analysis_products`
- `analysis_orders`
- `analysis_proformas`
- `analysis_workflows`
- `analysis_activities`
- و سایر جداول...

---

## 🔄 مراحل بعدی

برای استفاده از دیتابیس مشترک، باید:

1. **اپلیکیشن مدیریت ماموریت:**
   - تغییر از `sql.js` به `sqlite3`
   - تغییر مسیر دیتابیس به `shared.db`
   - به‌روزرسانی نام جداول (اضافه کردن prefix `mission_`)

2. **EZ Dashboard:**
   - تغییر مسیر دیتابیس به `shared.db`
   - به‌روزرسانی نام جداول (اضافه کردن prefix `analysis_`)

---

## ❓ سوال

**آیا اپلیکیشن دیگری روی پورت 5000 وجود دارد که باید در migration لحاظ شود؟**

اگر بله، لطفاً مسیر و اطلاعات آن را بدهید تا آن را هم به دیتابیس مشترک اضافه کنم.

