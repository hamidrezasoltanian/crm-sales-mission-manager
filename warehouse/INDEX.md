# ایندکس سیستم مدیریت انبار (WMS) آتنا زیست درمان

## فایل‌های موجود

| فایل | نوع | توضیح |
|------|-----|-------|
| [`atena_wms_v142.html`](./atena_wms_v142.html) | Single-file Web App | پروتوتایپ کامل WMS — نسخه v14.2 |
| [`documents/atena_wms_project_summary.docx`](./documents/atena_wms_project_summary.docx) | Word Document | مستندات فنی و نقشه راه پروژه |

---

## خلاصه سیستم

سیستم مدیریت انبار (WMS) اختصاصی برای **آتنا زیست درمان** — توزیع‌کننده تجهیزات پزشکی.

| شاخص | مقدار |
|------|-------|
| نسخه | Prototype v14 |
| معماری | Single HTML + JS + localStorage |
| تعداد توابع JS | ~۲۵۲ |
| تعداد سطور کد | ~۶۰۷۸ |
| حجم فایل | ۳۶۸ کیلوبایت |
| زبان | فارسی + انگلیسی (ترم‌های فنی) |

---

## ماژول‌های سیستم

### انبار
- **موجودی** (`p-inv`) — نمایش سلسله‌مراتبی Product → Lots، فیلتر، Export Excel/CSV/Print
- **انبارگردانی** (`p-count`) — شمارش فیزیکی و تطبیق با سیستم
- **تطبیق سه‌گانه** (`p-reconcile`) — مقایسه WMS / فرادیس / IMED در سطح Lot

### تراکنش‌ها
- **ورود کالا** (`p-entry`) — خرید، برگشت فروش، امانی، انتقال بین انبار، موجودی اولیه
- **خروج کالا** (`p-exit`) — فروش، امانی، برگشت به تأمین‌کننده، انتقال، نمونه — با FEFO خودکار
- **تاریخچه** (`p-hist`) — فیلتر پیشرفته با Export
- **ارسال و رهگیری** (`p-delivery`) — پیک (تیپاکس/ایرانپیام/چاپار/مستقیم) + کد رهگیری

### خرید
- **سفارش خرید (PO)** (`p-po`) — جریان: draft → pending → approved → received/partial

### مدیریت
- **کالاها** (`p-prods`) — کاتالوگ کامل، کپی کالا، جستجو پیشرفته
- **انبارها** (`p-whs`) — مدیریت موقعیت‌ها و مسئولان
- **طرف‌حساب‌ها** (`p-cp`) — تأمین‌کنندگان + مشتریان، Import Excel (۴۱۲۷ رکورد)
- **کاربران** (`p-users`) — نقش‌ها: admin / commercial / warehouse / sales_manager

### مالی
- **قیمت‌ها** (`p-prices`) — چند لیست قیمت + تاریخچه
- **انبار مجازی IMED** (`p-imed`) — ثبت per-transaction یا batch
- **گزارش‌ها** (`p-rpt`) — موجودی، گردش کالا، مقایسه دوره‌ای، فاکتورها، IMED

### تحلیل
- **سودآوری و پیش‌بینی** (`p-analytics`) — مارجین، سرعت گردش، پیش‌بینی خرید
- **Recall** (`p-recall`) — فراخوانی Lot، شناسایی مشتریان آسیب‌دیده

### سیستم
- **بک‌آپ** (`p-system`) — Export/Import JSON، Reset عملیاتی
- **لاگ فعالیت** (`p-audit`) — ۲۰۰۰ رکورد آخر، فیلتر کاربر/نوع/تاریخ

---

## مدل داده (State Object — localStorage)

| Collection | توضیح | کلیدهای اصلی |
|-----------|-------|--------------|
| `products[]` | کاتالوگ کالاها | id, name, fullName, catalogCode, ircCode, brand, size, unit |
| `lots[]` | موجودی به تفکیک Lot | id, productId, warehouseId, lotNo, qty, expiry, purchasePrice, ttacNo |
| `transactions[]` | تمام ورود/خروج‌ها | id, txnNo, type, txnType, productId, lotId, warehouseId, qty, status |
| `counterparties[]` | تأمین‌کنندگان + مشتریان | id, name, type, phone, address, taxCode |
| `warehouses[]` | انبارها | id, name, location, active |
| `users[]` | کاربران | id, name, role, pin |
| `purchaseOrders[]` | سفارش خرید | id, poNo, supplierId, warehouseId, status, items[] |
| `recalls[]` | فراخوانی کالا | id, recallNo, productId, affectedLots[], status |
| `priceLists[]` | لیست‌های قیمت | id, name, type, isDefault |
| `stockCounts[]` | انبارگردانی‌ها | id, countNo, warehouseId, items[], status |
| `auditLog[]` | لاگ فعالیت | id, ts, userId, action, entity, detail |

localStorage key: `atena_wms2`

---

## Stack فنی

```
HTML5 + Vanilla JavaScript (بدون Framework)
├── QR Code: qrcode.js + jsQR (scanner)
├── Excel Export: SheetJS (XLSX) — CDN dynamic load
├── فونت: Vazirmatn از Google Fonts
└── تقویم شمسی: Intl.DateTimeFormat با ca=persian
```

---

## نقش‌های کاربری

| کاربر | نقش | دسترسی‌ها |
|-------|-----|-----------|
| حمیدرضا | admin | همه صفحات + تأیید PO + تنظیمات |
| رویا محسنی | commercial | بازرگانی، تأیید ورود، تطبیق، سفارش خرید |
| بهروز آقایی | warehouse | ورود/خروج فیزیکی، گزارش موجودی |
| سارا حسینی | sales_manager | خروج کالا، تأیید تخفیف، پروفایل مشتریان |

---

## سامانه‌های رگولاتوری

| سامانه | کاربرد |
|--------|---------|
| IMED (imed.ir) | IRC، مجوز ورود/ترخیص، انبار مجازی، توزیع |
| TTAC (ttac.ir) | سیاست ارزی، برچسب اصالت، فورکست ماهانه |
| NTSW (ntsw.ir) | ثبت سفارش واردات |
| EPL گمرک | اظهارنامه گمرکی |

---

## نقشه راه Migration به PHP/MySQL

| فاز | مدت | شرح |
|-----|-----|-----|
| **A** — آماده‌سازی | ۲ هفته | XAMPP/VPS، Let's Encrypt SSL، Export JSON |
| **B** — Database Schema | ۱ هفته | طراحی جداول MySQL |
| **C** — PHP API | ۲ هفته | REST API، Session Auth، Data Import |
| **D** — ویژگی‌های جدید | Ongoing | API فرادیس، IMED، SMS، PWA |

### اولویت‌بندی ویژگی‌های فاز D

| ویژگی | اولویت |
|-------|--------|
| اتصال API فرادیس | بالا |
| اتصال IMED API | بالا |
| اعلان‌های SMS (پنل ملی پیامک) | متوسط |
| اپ موبایل PWA + Service Worker | متوسط |
| Barcode Scanner USB | پایین |
| گزارش‌ساز پویا (drag-drop) | پایین |

---

## تاریخچه نسخه‌ها

| نسخه | تغییرات |
|------|---------|
| v1–v3 | ساختار اولیه: داشبورد، موجودی، ورود/خروج |
| v4–v6 | FEFO، QR، انبارگردانی، کاربران، قیمت‌گذاری |
| v7 | IMED انبار مجازی، گزارش‌ها، چاپ حواله |
| v8 | PO، تطبیق سه‌گانه، Recall، تحلیل کسب‌وکار، بک‌آپ |
| v9 | FEFO Visual Chart، مقایسه دوره‌ای، SMS template |
| v10 | Import ۴۱۲۷ مشتری از Excel، نام کامل کالا، TTAC |
| v11 | قالب چاپ قابل تنظیم با live preview |
| v12 | تقویم شمسی Intl.DateTimeFormat، Date Picker |
| v13 | سرچ در همه لیست‌ها، Export موجودی Excel+Print |
| v14 | SS Engine جستجوی محصول، پنل Lot موجود، fix submitEntry |

---

*آتنا زیست درمان — خرداد ۱۴۰۴*
