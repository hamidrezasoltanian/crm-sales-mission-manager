# 🏗️ پیشنهاد معماری برای نیازهای جدید مراکز

## 📋 نیازهای جدید

### فیلدهای مرکز:
- ✅ فیلدهای متنوع قابل گسترش
- ✅ شماره تلفن (چندتایی)
- ✅ موبایل
- ✅ آدرس (چندتایی)
- ✅ کد اقتصادی
- ✅ شناسه ملی
- ✅ نوع (حقیقی/حقوقی)
- ✅ توضیحات
- ✅ وبسایت
- ✅ کد پستی
- ✅ اعتبار مالی
- ✅ تحویل گیرنده کالا
- ✅ اطلاعات بانکی (شماره حساب، شبا، کارت، نام بانک)

### پرسنل مرتبط با مرکز:
- ✅ نام و نام خانوادگی
- ✅ موبایل
- ✅ تلفن ثابت و داخلی
- ✅ پست سازمانی (از لیست کشویی)

---

## 🎯 تحلیل معماری

### گزینه 1: دیتابیس مشترک (توصیه می‌شود با شرایط) ✅

**با توجه به نیازهای جدید:**

#### ✅ مزایا (با نیازهای جدید):
1. **یکپارچگی داده‌ها**
   - مراکز در یک مکان
   - تغییرات فوری در هر دو اپ
   - Foreign keys بین جداول

2. **سادگی توسعه**
   - نیازی به سینک نیست
   - یک schema برای مراکز
   - توسعه راحت‌تر

3. **Performance**
   - دسترسی مستقیم
   - Query های ساده‌تر
   - بدون overhead سینک

4. **Schema انعطاف‌پذیر**
   - می‌توانیم فیلدهای جدید اضافه کنیم
   - JSON fields برای داده‌های پیچیده
   - جداول مرتبط برای پرسنل مرکز

#### ⚠️ معایب (قابل حل):
1. **Concurrent Access**
   - راه‌حل: استفاده از WAL mode
   - راه‌حل: استفاده از connection pooling
   - راه‌حل: محدود کردن concurrent writes

2. **Coupling**
   - راه‌حل: استفاده از prefix برای جداول (`mission_*`, `analysis_*`)
   - راه‌حل: Views برای جداسازی منطقی
   - راه‌حل: API layer برای abstraction

3. **تغییر کتابخانه**
   - راه‌حل: Migration از `sql.js` به `sqlite3`
   - راه‌حل: Refactoring تدریجی

---

## 🏗️ پیشنهاد معماری

### ساختار پیشنهادی:

#### 1. جداول اصلی (در دیتابیس مشترک):

```sql
-- مراکز (مشترک بین دو اپ)
CREATE TABLE centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  
  -- اطلاعات پایه
  type TEXT DEFAULT 'lead', -- lead, opportunity, customer, old_customer
  legal_type TEXT, -- 'حقیقی' یا 'حقوقی'
  
  -- اطلاعات تماس (JSON برای چندتایی)
  phones TEXT, -- JSON: ["021-12345678", "021-87654321"]
  mobile TEXT,
  website TEXT,
  
  -- اطلاعات آدرس (JSON برای چندتایی)
  addresses TEXT, -- JSON: [{"address": "...", "postal_code": "...", "city": "...", "province": "..."}]
  postal_code TEXT,
  city TEXT,
  province TEXT,
  district TEXT,
  
  -- اطلاعات مالی
  economic_code TEXT,
  national_id TEXT,
  financial_credit REAL,
  
  -- اطلاعات بانکی (JSON)
  bank_info TEXT, -- JSON: {"account": "...", "sheba": "...", "card": "...", "bank_name": "..."}
  
  -- اطلاعات انبار
  warehouse_receiver TEXT,
  
  -- سایر
  description TEXT,
  latitude REAL,
  longitude REAL,
  snapLocationId TEXT,
  
  -- مسئولیت
  responsiblePersonnelId INTEGER,
  
  -- وضعیت
  isActive INTEGER DEFAULT 1,
  tags TEXT, -- JSON array
  
  -- Timestamps
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (responsiblePersonnelId) REFERENCES personnel(id)
);

-- پرسنل مرتبط با مرکز
CREATE TABLE center_personnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  centerId INTEGER NOT NULL,
  
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  mobile TEXT,
  phone TEXT, -- تلفن ثابت
  extension TEXT, -- داخلی
  position TEXT, -- پست سازمانی (از لیست کشویی)
  
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (centerId) REFERENCES centers(id) ON DELETE CASCADE
);

-- لیست پست‌های سازمانی (برای dropdown)
CREATE TABLE organization_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  isActive INTEGER DEFAULT 1
);
```

#### 2. جداول اپلیکیشن مدیریت ماموریت:
```sql
-- با prefix mission_
mission_personnel
mission_assignments
mission_contacts
mission_discount_codes
mission_audit_logs
```

#### 3. جداول اپلیکیشن آنالیز فروش:
```sql
-- با prefix analysis_
analysis_users
analysis_products
analysis_orders
analysis_workflows
analysis_territories (یا استفاده از centers)
```

---

## 🔧 پیاده‌سازی

### مرحله 1: Migration از sql.js به sqlite3
- تغییر کتابخانه در اپلیکیشن مدیریت ماموریت
- Migration داده‌های موجود
- تست کامل

### مرحله 2: ایجاد دیتابیس مشترک
- ایجاد دیتابیس جدید
- Migration جداول از هر دو اپ
- استفاده از prefix برای جداول

### مرحله 3: اضافه کردن فیلدهای جدید
- اضافه کردن فیلدهای جدید به centers
- ایجاد جدول center_personnel
- ایجاد جدول organization_positions

### مرحله 4: Refactoring
- تغییر کدهای اپلیکیشن مدیریت ماموریت
- تغییر کدهای اپلیکیشن آنالیز فروش
- تست کامل

---

## ⚠️ نکات مهم

### 1. Concurrent Access
- استفاده از WAL mode (Write-Ahead Logging)
- استفاده از connection pooling
- محدود کردن concurrent writes

### 2. Backup
- Backup منظم دیتابیس مشترک
- Backup جداگانه برای هر اپ (optional)

### 3. Migration Strategy
- Migration تدریجی
- Backup قبل از migration
- Rollback plan

---

## 💡 توصیه نهایی

**با توجه به نیازهای جدید، استفاده از دیتابیس مشترک توصیه می‌شود** به دلایل:

1. ✅ نیاز به فیلدهای پیچیده و مرتبط
2. ✅ نیاز به یکپارچگی داده‌ها
3. ✅ سادگی توسعه
4. ✅ Performance بهتر

**اما باید:**
- از prefix برای جداول استفاده کنیم
- WAL mode را فعال کنیم
- Migration را به دقت انجام دهیم
- Backup منظم داشته باشیم

---

## 📝 مراحل پیاده‌سازی

1. **Migration از sql.js به sqlite3** (1-2 روز)
2. **ایجاد دیتابیس مشترک** (1 روز)
3. **Migration داده‌ها** (1 روز)
4. **اضافه کردن فیلدهای جدید** (2-3 روز)
5. **تست و Debug** (2-3 روز)

**کل زمان:** حدود 1-2 هفته

