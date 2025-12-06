# راهنمای آپلود به GitHub

## مرحله 1: ایجاد Repository در GitHub

1. به https://github.com بروید و وارد حساب کاربری خود شوید
2. روی دکمه **"New"** یا **"+"** کلیک کنید
3. یک نام برای repository انتخاب کنید (مثلاً: `crm-sales-mission-manager`)
4. توضیحات را وارد کنید: "CRM Sales Mission Manager System"
5. **Public** یا **Private** را انتخاب کنید
6. **توجه:** گزینه "Initialize this repository with a README" را **تیک نزنید**
7. روی **"Create repository"** کلیک کنید

## مرحله 2: اتصال و آپلود

بعد از ایجاد repository، نام کاربری GitHub و نام repository را به من بدهید تا دستورات را اجرا کنم.

یا می‌توانید خودتان این دستورات را اجرا کنید:

```bash
cd /home/hamidreza/App/sales-mission-manager

# اضافه کردن remote (نام کاربری و نام repository را جایگزین کنید)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# تغییر نام branch به main
git branch -M main

# آپلود به GitHub
git push -u origin main
```

## اطلاعات Repository

- **نام پیشنهادی:** `crm-sales-mission-manager`
- **توضیحات:** CRM Sales Mission Manager System - Complete CRM for managing sales missions
- **زبان:** TypeScript, JavaScript
- **License:** Private (یا MIT اگر می‌خواهید public باشد)

## فایل‌های حذف شده از Git

فایل‌های زیر به دلیل .gitignore اضافه نشده‌اند:
- `node_modules/` - Dependencies
- `*.db` - Database files
- `logs/` - Log files
- `.env` - Environment variables
- `.next/` - Next.js build files

## نکات مهم

1. **فایل .env را دستی اضافه نکنید** - این فایل شامل اطلاعات حساس است
2. **Database files اضافه نشده‌اند** - باید بعد از clone کردن پروژه، database را ایجاد کنید
3. **node_modules اضافه نشده** - باید بعد از clone، `npm install` را اجرا کنید

