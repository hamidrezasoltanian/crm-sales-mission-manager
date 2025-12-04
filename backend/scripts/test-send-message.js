/**
 * تست ارسال پیام مستقیم به کاربر
 */

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.argv[2]; // Telegram ID یا Chat ID

console.log('\n🔍 تست ارسال پیام مستقیم...\n');

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN تنظیم نشده است!');
  process.exit(1);
}

if (!chatId) {
  console.error('❌ Chat ID یا Telegram ID را وارد کنید');
  console.log('\n📝 استفاده:');
  console.log('   node scripts/test-send-message.js <chat-id-or-telegram-id>\n');
  console.log('💡 برای پیدا کردن Chat ID:');
  console.log('   1. در تلگرام به ربات پیام بفرستید');
  console.log('   2. Chat ID در لاگ‌ها نمایش داده می‌شود\n');
  process.exit(1);
}

try {
  const bot = new TelegramBot(token, { polling: false });
  
  console.log(`📤 ارسال پیام تست به ${chatId}...\n`);
  
  const message = `🧪 این یک پیام تست است!\n\n` +
    `اگر این پیام را دریافت کردید، ربات کار می‌کند.\n\n` +
    `📅 زمان: ${new Date().toLocaleString('fa-IR')}\n` +
    `🆔 Chat ID: ${chatId}`;
  
  bot.sendMessage(chatId, message)
    .then(() => {
      console.log('✅ پیام با موفقیت ارسال شد!');
      console.log(`   به Chat ID: ${chatId}\n`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ خطا در ارسال پیام:');
      console.error(`   Message: ${error.message}`);
      if (error.response) {
        console.error(`   Response: ${JSON.stringify(error.response.body, null, 2)}`);
      }
      console.error(`   Stack: ${error.stack}\n`);
      process.exit(1);
    });
  
} catch (error) {
  console.error('\n❌ خطا:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}


