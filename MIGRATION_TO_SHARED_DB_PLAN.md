# 📋 برنامه Migration به دیتابیس مشترک

## ✅ کارهای انجام شده

1. ✅ دیتابیس مشترک (`shared.db`) ایجاد شد
2. ✅ داده‌ها migrate شدند
3. ✅ `database.js` به `sqlite3` تبدیل شد
4. ✅ `Personnel.js` به async تبدیل شد
5. ✅ `routes/personnel.js` به async تبدیل شد

## ⏳ کارهای باقی‌مانده

### مرحله 1: به‌روزرسانی مدل‌ها
- [ ] `Assignment.js` - تبدیل به async و استفاده از `mission_assignments`
- [ ] `Center.js` - تبدیل به async
- [ ] `Contact.js` - تبدیل به async و استفاده از `mission_contacts`
- [ ] `DiscountCode.js` - تبدیل به async و استفاده از `mission_discount_codes`
- [ ] `Mission.js` - تبدیل به async

### مرحله 2: به‌روزرسانی Routes
- [x] `routes/personnel.js` ✅
- [ ] `routes/centers.js` - تبدیل به async
- [ ] `routes/assignments.js` - تبدیل به async
- [ ] `routes/contacts.js` - تبدیل به async
- [ ] `routes/discountCodes.js` - تبدیل به async
- [ ] `routes/reports.js` - تبدیل به async

### مرحله 3: به‌روزرسانی Services
- [ ] `services/telegramBot.js` - تبدیل تمام فراخوانی‌های مدل‌ها به async
- [ ] سایر services

### مرحله 4: تغییر نام جداول در Query ها
- [ ] `assignments` → `mission_assignments`
- [ ] `contacts` → `mission_contacts`
- [ ] `discount_codes` → `mission_discount_codes`
- [ ] `audit_logs` → `mission_audit_logs`

### مرحله 5: به‌روزرسانی اپلیکیشن آنالیز فروش
- [ ] تغییر مسیر دیتابیس از `sales_dashboard.db` به `shared.db`
- [ ] به‌روزرسانی query ها برای استفاده از جداول `analysis_*`

## ⚠️ نکات مهم

1. **همه متدهای مدل‌ها باید async شوند**
2. **همه route handlers باید async شوند**
3. **همه فراخوانی‌های مدل‌ها باید await شوند**
4. **نام جداول باید تغییر کند: `assignments` → `mission_assignments`**

## 🔄 استراتژی

بهتر است به صورت تدریجی انجام شود:
1. ابتدا یک مدل کامل تبدیل شود (مثل Personnel که انجام شد)
2. سپس routes مربوطه
3. سپس services
4. سپس مدل بعدی

یا می‌توان یک script برای تبدیل خودکار نوشت.

