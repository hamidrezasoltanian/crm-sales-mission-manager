# 🔧 Fix مشکل Regex برای /status و /approve

## 🔍 مشکل:

- `/status <id>` کار نمی‌کرد
- `/status` خالی کار نمی‌کرد
- `/approve_<id>` کار نمی‌کرد
- `/approve` خالی کار نمی‌کرد

## ✅ علت:

Regex patterns پیچیده بودند و به درستی match نمی‌کردند.

## 🔧 راه‌حل:

**تغییر به دو handler جداگانه برای هر دستور** (مثل `/start`):

### برای `/status`:
1. `/\/status$/` - برای `/status` خالی
2. `/\/status\s+(\d+)/` - برای `/status <id>`

### برای `/approve`:
1. `/\/approve$/` - برای `/approve` خالی
2. `/\/approve_(\d+)/` - برای `/approve_<id>`

## 📋 تغییرات:

- هر دستور حالا دو handler جداگانه دارد
- Regex ها ساده و مستقیم هستند (مثل `/start`)
- لاگ اضافه شده برای debugging

## ✅ نتیجه:

حالا همه دستورات باید کار کنند:
- `/status` ✅ (خالی)
- `/status 1` ✅ (با ID)
- `/approve` ✅ (خالی)
- `/approve_1` ✅ (با ID)

**Backend راه‌اندازی مجدد شد. لطفاً تست کنید!**

