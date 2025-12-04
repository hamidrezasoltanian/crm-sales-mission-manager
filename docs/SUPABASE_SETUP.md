# راهنمای استفاده از Supabase (گزینه ابری رایگان)

Supabase یک جایگزین رایگان و عالی برای MongoDB است که PostgreSQL را با API REST آماده ارائه می‌دهد.

## مزایای Supabase

- ✅ 500MB فضای رایگان
- ✅ PostgreSQL قدرتمند
- ✅ API REST خودکار
- ✅ Authentication داخلی
- ✅ Real-time subscriptions
- ✅ Dashboard زیبا برای مدیریت

## راه‌اندازی

### 1. ایجاد حساب Supabase

1. به https://supabase.com بروید
2. روی "Start your project" کلیک کنید
3. با GitHub یا ایمیل ثبت‌نام کنید
4. یک پروژه جدید ایجاد کنید

### 2. ایجاد جدول missions

در Supabase Dashboard:
1. به SQL Editor بروید
2. این SQL را اجرا کنید:

```sql
CREATE TABLE missions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
  assigned_to TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ایجاد تابع برای به‌روزرسانی updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ایجاد trigger
CREATE TRIGGER update_missions_updated_at 
BEFORE UPDATE ON missions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- فعال کردن Row Level Security (اختیاری)
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

-- ایجاد policy برای دسترسی عمومی (برای توسعه)
CREATE POLICY "Enable all operations for all users" 
ON missions FOR ALL 
USING (true) 
WITH CHECK (true);
```

### 3. دریافت API Keys

1. در Supabase Dashboard، به Settings > API بروید
2. `Project URL` و `anon/public key` را کپی کنید

### 4. نصب Supabase Client

```bash
cd backend
npm install @supabase/supabase-js
```

### 5. تنظیم فایل .env

```env
PORT=5000
SUPABASE_URL=your-project-url
SUPABASE_KEY=your-anon-key
```

### 6. به‌روزرسانی کد (اختیاری)

می‌توانید مدل Mission را برای استفاده از Supabase تغییر دهید، اما SQLite برای شروع کافی است.

## استفاده از Supabase REST API

می‌توانید مستقیماً از REST API استفاده کنید:

```javascript
// GET تمام missions
fetch('https://your-project.supabase.co/rest/v1/missions', {
  headers: {
    'apikey': 'your-anon-key',
    'Authorization': 'Bearer your-anon-key'
  }
})

// POST ایجاد mission
fetch('https://your-project.supabase.co/rest/v1/missions', {
  method: 'POST',
  headers: {
    'apikey': 'your-anon-key',
    'Authorization': 'Bearer your-anon-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'ماموریت جدید',
    status: 'pending'
  })
})
```

## مقایسه SQLite و Supabase

| ویژگی | SQLite | Supabase |
|-------|--------|----------|
| نصب | خودکار | نیاز به ثبت‌نام |
| هزینه | رایگان | رایگان (تا 500MB) |
| سرور | نیاز نیست | ابری |
| دسترسی از راه‌دور | نیاز به تنظیمات | آماده |
| Real-time | خیر | بله |
| Authentication | دستی | آماده |
| مناسب برای | پروژه‌های کوچک | پروژه‌های متوسط-بزرگ |

## توصیه

- برای شروع و پروژه‌های کوچک: **SQLite** (فعلی)
- برای پروژه‌های production و نیاز به دسترسی از راه‌دور: **Supabase**
