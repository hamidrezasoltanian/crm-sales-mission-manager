# 👥 پیشنهاد جدول مشترک کارمندان

## ✅ تایید پیشنهاد شما

**بله، کاملاً موافقم!** داشتن جدول مشترک کارمندان برای آنالیز بسیار بهتر است.

---

## 📊 مقایسه ساختار فعلی

### اپلیکیشن مدیریت ماموریت (`personnel`):
```sql
CREATE TABLE personnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  telegramId TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff')),
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### اپلیکیشن آنالیز فروش (`users`):
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'USER',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🎯 ساختار پیشنهادی جدول مشترک

### جدول `personnel` (مشترک):

```sql
CREATE TABLE personnel (
  -- شناسه
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- اطلاعات هویتی
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) VIRTUAL, -- برای سازگاری با کد قدیم
  
  -- اطلاعات تماس
  phone TEXT UNIQUE NOT NULL,
  mobile TEXT,
  email TEXT UNIQUE,
  telegramId TEXT UNIQUE,
  
  -- اطلاعات احراز هویت (برای اپلیکیشن آنالیز فروش)
  username TEXT UNIQUE,
  password_hash TEXT,
  
  -- نقش و دسترسی
  role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff', 'USER', 'ADMIN')),
  isActive INTEGER NOT NULL DEFAULT 1,
  
  -- اطلاعات اضافی
  avatar_url TEXT,
  last_login_at TEXT,
  
  -- Timestamps
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes برای performance
CREATE INDEX idx_personnel_phone ON personnel(phone);
CREATE INDEX idx_personnel_email ON personnel(email);
CREATE INDEX idx_personnel_telegramId ON personnel(telegramId);
CREATE INDEX idx_personnel_role ON personnel(role);
CREATE INDEX idx_personnel_isActive ON personnel(isActive);
```

---

## 🔄 Migration Strategy

### مرحله 1: Merge داده‌های موجود

```sql
-- از اپلیکیشن مدیریت ماموریت
INSERT INTO personnel (id, first_name, last_name, phone, telegramId, role, isActive, createdAt, updatedAt)
SELECT 
  id,
  CASE 
    WHEN name LIKE '% %' THEN substr(name, 1, instr(name, ' ') - 1)
    ELSE name
  END as first_name,
  CASE 
    WHEN name LIKE '% %' THEN substr(name, instr(name, ' ') + 1)
    ELSE ''
  END as last_name,
  phone,
  telegramId,
  role,
  isActive,
  createdAt,
  updatedAt
FROM mission_personnel; -- جدول قدیم

-- از اپلیکیشن آنالیز فروش
INSERT INTO personnel (first_name, last_name, phone, email, username, password_hash, role, isActive, avatar_url, last_login_at, createdAt, updatedAt)
SELECT 
  first_name,
  last_name,
  phone,
  email,
  username,
  password_hash,
  CASE 
    WHEN role = 'ADMIN' THEN 'admin'
    WHEN role = 'USER' THEN 'staff'
    ELSE 'staff'
  END as role,
  is_active,
  avatar_url,
  last_login_at,
  created_at,
  updated_at
FROM analysis_users -- جدول قدیم
WHERE phone NOT IN (SELECT phone FROM personnel); -- جلوگیری از duplicate
```

---

## ✅ مزایای جدول مشترک کارمندان

### 1. **یکپارچگی داده‌ها**
- ✅ یک منبع واحد برای اطلاعات کارمندان
- ✅ تغییرات فوری در هر دو اپلیکیشن
- ✅ جلوگیری از duplicate data

### 2. **آنالیز بهتر**
- ✅ Query های ساده‌تر برای گزارش‌گیری
- ✅ JOIN های مستقیم بین جداول
- ✅ یکپارچگی در Foreign Keys

### 3. **سادگی توسعه**
- ✅ نیازی به sync نیست
- ✅ یک schema برای کارمندان
- ✅ توسعه راحت‌تر

### 4. **Foreign Keys بهتر**
```sql
-- در جداول ماموریت
mission_assignments.personnelId → personnel.id ✅

-- در جداول آنالیز فروش
analysis_orders.assigned_to → personnel.id ✅
analysis_mission_logs.employee_id → personnel.id ✅
```

---

## 📋 ساختار نهایی دیتابیس مشترک

### ✅ جداول مشترک:
1. **`personnel`** - کارمندان (مشترک) ✨
2. **`centers`** - مراکز (مشترک)
3. **`center_personnel`** - پرسنل مرتبط با مرکز (مشترک)
4. **`organization_positions`** - پست‌های سازمانی (مشترک)

### 🔵 جداول اپلیکیشن مدیریت ماموریت (`mission_*`):
- `mission_assignments` → `personnelId` → `personnel.id`
- `mission_contacts`
- `mission_discount_codes`
- `mission_audit_logs`

### 🟢 جداول اپلیکیشن آنالیز فروش (`analysis_*`):
- `analysis_orders` → `assigned_to` → `personnel.id`
- `analysis_mission_logs` → `employee_id` → `personnel.id`
- `analysis_products`
- `analysis_workflows`
- `analysis_kpi_configs`

---

## 🎯 مثال Query برای آنالیز

### مثال 1: گزارش عملکرد کارمندان
```sql
SELECT 
  p.first_name || ' ' || p.last_name as employee_name,
  COUNT(DISTINCT ma.id) as total_missions,
  COUNT(DISTINCT ao.id) as total_orders,
  SUM(ao.total_amount) as total_sales
FROM personnel p
LEFT JOIN mission_assignments ma ON ma.personnelId = p.id
LEFT JOIN analysis_orders ao ON ao.assigned_to = p.id
WHERE p.isActive = 1
GROUP BY p.id;
```

### مثال 2: کارمندان با بیشترین ماموریت
```sql
SELECT 
  p.name,
  COUNT(ma.id) as mission_count
FROM personnel p
JOIN mission_assignments ma ON ma.personnelId = p.id
WHERE ma.status = 'completed'
GROUP BY p.id
ORDER BY mission_count DESC;
```

---

## 💡 توصیه نهایی

**✅ کاملاً موافقم!** جدول مشترک کارمندان:

1. ✅ آنالیز را بسیار راحت‌تر می‌کند
2. ✅ یکپارچگی داده‌ها را تضمین می‌کند
3. ✅ Foreign Keys را ساده‌تر می‌کند
4. ✅ از duplicate data جلوگیری می‌کند

**ساختار پیشنهادی:**
- جدول `personnel` مشترک با فیلدهای کامل
- Migration داده‌های موجود از هر دو اپ
- Foreign Keys به `personnel.id` در هر دو اپ

---

## 📝 مراحل پیاده‌سازی

1. ✅ ایجاد جدول `personnel` مشترک با فیلدهای کامل
2. ✅ Migration داده‌های `mission_personnel` → `personnel`
3. ✅ Migration داده‌های `analysis_users` → `personnel` (با merge)
4. ✅ به‌روزرسانی Foreign Keys در جداول مرتبط
5. ✅ حذف جداول قدیم (`mission_personnel`, `analysis_users`)
6. ✅ تست کامل

**آماده‌ایم شروع کنیم؟** 🚀

