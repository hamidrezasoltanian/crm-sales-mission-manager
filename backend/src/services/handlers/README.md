# Telegram Bot Handlers

این پوشه شامل handlerهای مختلف برای ربات تلگرام است.

## ساختار

- `commandHandlers.js` - دستورات ربات (/start, /missions, etc.)
- `callbackHandlers.js` - Callback query handlers (دکمه‌های inline keyboard)
- `messageHandlers.js` - Message handlers (پیام‌های متنی در conversation)

## نحوه استفاده

این handlerها به تدریج از فایل اصلی `telegramBot.js` استخراج می‌شوند و در این ماژول‌ها قرار می‌گیرند.

## وضعیت

این ساختار در حال توسعه است و به تدریج تکمیل می‌شود.

