/**
 * اسکریپت تست ربات تلگرام
 * این اسکریپت بررسی می‌کند که آیا Token درست است و ربات می‌تواند به Telegram متصل شود
 */

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

console.log('\n🔍 تست اتصال ربات تلگرام...\n');

if (!token || token === 'your-telegram-bot-token-here' || !token.trim()) {
  console.error('❌ خطا: TELEGRAM_BOT_TOKEN تنظیم نشده است!');
  console.log('\n📝 راه‌حل:');
  console.log('   1. به @BotFather در تلگرام بروید');
  console.log('   2. /newbot را بفرستید و یک ربات بسازید');
  console.log('   3. Token را در backend/.env قرار دهید:');
  console.log('      TELEGRAM_BOT_TOKEN=your-token-here\n');
  process.exit(1);
}

console.log('✅ Token پیدا شد');
console.log(`   Token (اول 20 کاراکتر): ${token.substring(0, 20)}...`);

try {
  console.log('\n🔄 در حال اتصال به Telegram...');
  
  const bot = new TelegramBot(token, { polling: false });
  
  bot.getMe().then((botInfo) => {
    console.log('\n✅ اتصال موفق!');
    console.log(`   🤖 نام ربات: ${botInfo.first_name}`);
    console.log(`   📝 Username: @${botInfo.username}`);
    console.log(`   🆔 Bot ID: ${botInfo.id}`);
    console.log('\n✨ ربات آماده است!');
    console.log('   حالا Backend را اجرا کنید و با ربات در تلگرام چت کنید.\n');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ خطا در اتصال:');
    console.error(`   ${error.message}\n`);
    
    if (error.response) {
      console.error('   جزئیات خطا:');
      console.error(`   Status: ${error.response.statusCode}`);
      console.error(`   Description: ${error.response.body?.description || 'Unknown'}\n`);
    }
    
    console.log('💡 راه‌حل:');
    console.log('   1. مطمئن شوید Token درست است');
    console.log('   2. Token را از @BotFather دوباره بگیرید');
    console.log('   3. مطمئن شوید Token در .env بدون quotes است\n');
    process.exit(1);
  });
} catch (error) {
  console.error('\n❌ خطا در ایجاد ربات:');
  console.error(`   ${error.message}\n`);
  process.exit(1);
}


