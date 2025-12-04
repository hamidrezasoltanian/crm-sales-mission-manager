# 🤖 وضعیت استقرار هوش مصنوعی در ربات تلگرام

## ✅ خلاصه وضعیت

استقرار هوش مصنوعی در ربات تلگرام **تکمیل شده** و آماده استفاده است. سیستم از **Google Gemini AI** برای پردازش دستورات صوتی و متنی استفاده می‌کند.

---

## 📦 کامپوننت‌های پیاده‌سازی شده

### 1️⃣ **AiRouter** (`backend/src/services/aiRouter.js`)
- ✅ کلاس `AiRouter` برای ارتباط با Google Gemini AI
- ✅ مدل پیش‌فرض: `gemini-2.5-flash`
- ✅ پردازش intent های مختلف:
  - `create_assignment`: ایجاد ماموریت جدید
  - `create_contact`: ثبت تماس با مرکز
  - `request_report`: درخواست گزارش
  - `request_leave`: درخواست مرخصی
  - `unknown`: درخواست نامشخص
- ✅ استخراج اطلاعات ساختاریافته از متن فارسی
- ✅ مدیریت خطا و fallback

### 2️⃣ **SpeechService** (`backend/src/services/speechService.js`)
- ✅ تبدیل پیام‌های صوتی تلگرام به متن
- ✅ استفاده از Google Cloud Speech-to-Text
- ✅ پشتیبانی از زبان فارسی (`fa-IR`)
- ✅ فرمت صوتی: OGG_OPUS با نرخ نمونه‌برداری 48000 Hz

### 3️⃣ **ادغام در TelegramBot** (`backend/src/services/telegramBot.js`)
- ✅ پردازش پیام‌های صوتی (`handleAiVoiceCommand`)
- ✅ پردازش پیام‌های متنی (`handleAiTextCommand`)
- ✅ مدیریت مکالمه‌های follow-up (`handleAiFollowupMessage`)
- ✅ اجرای intent های مختلف:
  - `handleAiIntentCreateContact`: ثبت تماس
  - `handleAiIntentCreateAssignment`: ایجاد ماموریت
  - `handleAiIntentRequestLeave`: درخواست مرخصی
  - `handleAiIntentRequestReport`: تولید گزارش

---

## 🔧 تنظیمات مورد نیاز

### متغیرهای محیطی (`.env`)

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash  # اختیاری، پیش‌فرض: gemini-2.5-flash

# Google Cloud Speech-to-Text (برای پیام‌های صوتی)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
SPEECH_LANGUAGE_CODE=fa-IR
SPEECH_ENCODING=OGG_OPUS
SPEECH_SAMPLE_RATE=48000
```

### پکیج‌های نصب شده

```json
{
  "@google/generative-ai": "^0.11.3",
  "@google-cloud/speech": "^7.2.0"
}
```

---

## 🎯 نحوه کار

### 1. **پیام‌های صوتی**
- کاربر پیام صوتی ارسال می‌کند
- `SpeechService` آن را به متن تبدیل می‌کند
- `AiRouter` متن را تحلیل و intent را تشخیص می‌دهد
- سیستم عملیات مربوطه را انجام می‌دهد

### 2. **پیام‌های متنی**
- کاربر متن فارسی ارسال می‌کند (بدون `/`)
- `AiRouter` مستقیماً متن را تحلیل می‌کند
- intent تشخیص داده شده و عملیات انجام می‌شود

### 3. **مکالمه Follow-up**
- اگر AI نیاز به اطلاعات بیشتر داشته باشد
- `followUpQuestion` به کاربر ارسال می‌شود
- پاسخ کاربر دوباره به AI ارسال می‌شود
- فرآیند تا تکمیل اطلاعات ادامه می‌یابد

---

## 📋 Intent های پشتیبانی شده

### ✅ `create_assignment` - ایجاد ماموریت
**فیلدهای استخراج شده:**
- `centerName`: نام مرکز
- `centerCity`: شهر مرکز
- `assignee`: پرسنل مسئول
- `startDate`, `endDate`: تاریخ شروع و پایان
- `notes`: یادداشت‌ها
- `snapCost`: هزینه اسنپ
- `discountCode`: کد تخفیف

**مثال:**
```
"می‌خوام ماموریت به مرکز فلان در تهران ثبت کنم"
```

### ✅ `create_contact` - ثبت تماس
**فیلدهای استخراج شده:**
- `centerName`: نام مرکز
- `centerCity`: شهر
- `contactType`: نوع تماس (tehran/province/visit/phone)
- `notes`: یادداشت تماس
- `tags`: برچسب‌ها

**مثال:**
```
"تماس با مرکز فلان در اصفهان داشتم"
```

### ✅ `request_report` - درخواست گزارش
**فیلدهای استخراج شده:**
- `reportType`: نوع گزارش (assignments/contacts/combined)
- `timeRange`: بازه زمانی (day/week/month/all)

**مثال:**
```
"گزارش ماموریت‌های این هفته رو بده"
```

### ✅ `request_leave` - درخواست مرخصی
**فیلدهای استخراج شده:**
- `leaveType`: نوع مرخصی (annual/sick/hourly/emergency)
- `startDate`, `endDate`: تاریخ شروع و پایان
- `days`: تعداد روزها
- `startTime`, `endTime`: ساعت (برای مرخصی ساعتی)
- `reason`: دلیل مرخصی

**مثال:**
```
"می‌خوام مرخصی استحقاقی از فردا تا سه روز بگیرم"
```

---

## 🔍 وضعیت فعلی

### ✅ **کامل شده:**
- [x] کلاس `AiRouter` با پشتیبانی از Gemini
- [x] کلاس `SpeechService` برای تبدیل صدا به متن
- [x] ادغام در `TelegramBotService`
- [x] پردازش intent های مختلف
- [x] مدیریت مکالمه‌های follow-up
- [x] مدیریت خطا و fallback
- [x] پشتیبانی از زبان فارسی

### ⚠️ **نیاز به تنظیم:**
- [ ] تنظیم `GEMINI_API_KEY` در `.env`
- [ ] تنظیم `GOOGLE_APPLICATION_CREDENTIALS` برای Speech-to-Text
- [ ] تست کامل با پیام‌های واقعی

### 📝 **بهبودهای پیشنهادی:**
- [ ] اضافه کردن intent های بیشتر
- [ ] بهبود دقت تشخیص intent
- [ ] اضافه کردن logging بیشتر برای debugging
- [ ] اضافه کردن metrics برای monitoring

---

## 🚀 نحوه استفاده

### برای کاربران:
1. پیام صوتی یا متنی به ربات ارسال کنید
2. ربات درخواست را تحلیل می‌کند
3. اگر نیاز به اطلاعات بیشتر باشد، سوال می‌پرسد
4. پس از تکمیل اطلاعات، عملیات انجام می‌شود

### برای توسعه‌دهندگان:
```javascript
// بررسی فعال بودن AI
if (this.aiRouter?.isEnabled()) {
  const result = await this.aiRouter.interpret(text, context);
  // result.intent, result.confidence, result.fields, result.response
}
```

---

## 📊 آمار و اطلاعات

- **تعداد Intent های پشتیبانی شده:** 4
- **زبان پشتیبانی شده:** فارسی (fa-IR)
- **مدل AI:** Google Gemini 2.5 Flash
- **سرویس تبدیل صدا:** Google Cloud Speech-to-Text

---

## 🔗 فایل‌های مرتبط

- `backend/src/services/aiRouter.js` - کلاس اصلی AI Router
- `backend/src/services/speechService.js` - سرویس تبدیل صدا به متن
- `backend/src/services/telegramBot.js` - ادغام در ربات تلگرام
- `backend/package.json` - وابستگی‌ها

---

**تاریخ به‌روزرسانی:** 2025-01-17
**وضعیت:** ✅ آماده استفاده (نیاز به تنظیم API Keys)

