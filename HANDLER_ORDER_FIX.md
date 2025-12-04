# 🔧 Fix مشکل Handler Order

## 🔍 مشکل:

**هیچ دستوری به جز `/start` کار نمی‌کرد.**

## ✅ علت:

Handler `on('message')` قبل از `onText` handlers register می‌شد و همه پیام‌ها (از جمله commands) را intercept می‌کرد.

## 🔧 راه‌حل:

**تغییر ترتیب registration:**
1. ابتدا همه `onText` handlers register می‌شوند
2. سپس `on('callback_query')` برای Inline Keyboard
3. در آخر `on('message')` برای conversation handling

## 📋 تغییرات:

- `on('message')` به انتهای `setupCommands()` منتقل شد
- فقط برای conversation messages استفاده می‌شود (نه commands)
- Commands توسط `onText` handlers handle می‌شوند

## ✅ نتیجه:

حالا همه دستورات باید کار کنند:
- `/start` ✅
- `/missions` ✅
- `/newmission` ✅
- `/status <id>` ✅
- `/report` ✅
- `/help` ✅
- `/pending` ✅ (مدیران)
- `/approve_<id>` ✅ (مدیران)

**Backend راه‌اندازی مجدد شد. لطفاً تست کنید!**
