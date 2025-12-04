# MCP Server for Center Suggestions

این MCP Server برای پیشنهاد مراکز از لیست موجود در دیتابیس استفاده می‌شود. وقتی نام مرکز پیدا نمی‌شود، از لیست موجود پیشنهادات مشابه را برمی‌گرداند.

## ویژگی‌ها

- ✅ جستجوی هوشمند (Fuzzy Search) با scoring
- ✅ فقط از مراکز موجود در دیتابیس پیشنهاد می‌دهد
- ✅ پشتیبانی از فیلتر شهر و استان
- ✅ مرتب‌سازی بر اساس relevance
- ✅ نرمال‌سازی نام مراکز (حذف کلمات اضافی)

## نصب

```bash
cd /home/hamidreza/App/sales-mission-manager/backend
npm install
```

## راه‌اندازی

### برای Cursor/Claude Desktop

فایل تنظیمات MCP را در مسیر زیر ایجاد/ویرایش کنید:

**Linux/Mac:**
```
~/.config/cursor/mcp.json
```

**Windows:**
```
%APPDATA%\Cursor\mcp.json
```

محتوای فایل:

```json
{
  "mcpServers": {
    "center-suggestions": {
      "command": "node",
      "args": [
        "/home/hamidreza/App/sales-mission-manager/backend/src/mcp/centerSuggestionsServer.js"
      ],
      "env": {
        "DB_PATH": "/home/hamidreza/App/sales-mission-manager/backend/data",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### تست مستقیم

```bash
cd /home/hamidreza/App/sales-mission-manager/backend
node src/mcp/centerSuggestionsServer.js
```

## استفاده

MCP Server یک tool به نام `search_centers` ارائه می‌دهد:

### پارامترها

- `searchTerm` (الزامی): نام مرکز یا بخشی از نام
- `city` (اختیاری): نام شهر برای فیلتر
- `province` (اختیاری): نام استان برای فیلتر
- `limit` (اختیاری): حداکثر تعداد نتایج (پیش‌فرض: 5)

### مثال

```json
{
  "searchTerm": "نیکان",
  "city": "تهران",
  "limit": 5
}
```

### پاسخ

```json
{
  "message": "برای \"نیکان\" 3 مرکز مشابه پیدا شد:",
  "searchTerm": "نیکان",
  "originalSearchTerm": "نیکان",
  "suggestions": [
    {
      "id": 123,
      "name": "بیمارستان نیکان",
      "city": "تهران",
      "province": "تهران",
      "address": "...",
      "type": "customer",
      "responsiblePersonnel": "علی احمدی",
      "score": 95.5
    }
  ],
  "totalFound": 3
}
```

## الگوریتم Scoring

امتیازدهی بر اساس:

- تطابق دقیق نام: 100 امتیاز
- شروع با جستجو: 80 امتیاز
- شامل بودن جستجو: 60 امتیاز
- شباهت fuzzy: تا 40 امتیاز
- تطابق شهر: 30 امتیاز
- تطابق در آدرس: 10 امتیاز
- مراکز فعال: 5 امتیاز اضافی

فقط نتایج با امتیاز بالای 20 برگردانده می‌شوند.

## Troubleshooting

### خطای "Database not initialized"

مطمئن شوید که:
1. دیتابیس در مسیر صحیح وجود دارد
2. متغیر محیطی `DB_PATH` تنظیم شده است
3. دسترسی‌های فایل درست است

### خطای "Module not found"

```bash
cd /home/hamidreza/App/sales-mission-manager/backend
npm install
```

## لاگ‌ها

MCP Server از `console.error` برای لاگ استفاده می‌کند (برای جلوگیری از تداخل با stdout که برای MCP protocol استفاده می‌شود).


