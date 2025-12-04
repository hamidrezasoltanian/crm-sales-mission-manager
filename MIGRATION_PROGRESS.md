# 📊 پیشرفت Migration به دیتابیس مشترک

## ✅ کارهای انجام شده

### 1. دیتابیس مشترک
- ✅ دیتابیس `shared.db` ایجاد شد
- ✅ داده‌ها migrate شدند
- ✅ `database.js` به `sqlite3` تبدیل شد

### 2. مدل‌ها
- ✅ `Personnel.js` - تبدیل به async و استفاده از sqlite3
- ✅ `Center.js` - تبدیل به async و استفاده از sqlite3

### 3. Routes
- ✅ `routes/personnel.js` - تبدیل به async
- ✅ `routes/centers.js` - تبدیل به async

## ⏳ کارهای باقی‌مانده

### مدل‌ها
- [ ] `Assignment.js` - تبدیل به async و تغییر نام جدول به `mission_assignments`
- [ ] `Contact.js` - تبدیل به async و تغییر نام جدول به `mission_contacts`
- [ ] `DiscountCode.js` - تبدیل به async و تغییر نام جدول به `mission_discount_codes`
- [ ] `Mission.js` - تبدیل به async

### Routes
- [ ] `routes/assignments.js` - تبدیل به async
- [ ] `routes/contacts.js` - تبدیل به async
- [ ] `routes/discountCodes.js` - تبدیل به async
- [ ] `routes/reports.js` - تبدیل به async

### Services
- [ ] `services/telegramBot.js` - تبدیل تمام فراخوانی‌های مدل‌ها به async

### تغییر نام جداول
- [ ] `assignments` → `mission_assignments` در تمام query ها
- [ ] `contacts` → `mission_contacts` در تمام query ها
- [ ] `discount_codes` → `mission_discount_codes` در تمام query ها
- [ ] `audit_logs` → `mission_audit_logs` در تمام query ها

## 📝 یادداشت‌ها

- تمام متدهای مدل‌ها باید async شوند
- تمام route handlers باید async شوند
- تمام فراخوانی‌های مدل‌ها باید await شوند
- استفاده از parameterized queries برای امنیت (جلوگیری از SQL injection)
- حذف `autoSave()` چون دیگر نیاز نیست (sqlite3 خودکار ذخیره می‌کند)

## 🎯 مرحله بعدی

تبدیل `Assignment.js` و `routes/assignments.js` - این مهم‌ترین مدل است چون بیشترین استفاده را دارد.

