/**
 * اسکریپت دیباگ ربات تلگرام
 * این اسکریپت بررسی می‌کند که آیا ربات می‌تواند پیام‌ها را دریافت و ارسال کند
 */

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

console.log('\n🔍 دیباگ ربات تلگرام...\n');

if (!token || token === 'your-telegram-bot-token-here' || !token.trim()) {
  console.error('❌ خطا: TELEGRAM_BOT_TOKEN تنظیم نشده است!');
  process.exit(1);
}

console.log('✅ Token پیدا شد');
console.log(`   Token: ${token.substring(0, 20)}...`);

try {
  console.log('\n🔄 ایجاد ربات...');
  const bot = new TelegramBot(token, { polling: true });
  
  console.log('✅ ربات ایجاد شد');
  
  bot.getMe().then((botInfo) => {
    console.log('\n✅ اتصال موفق!');
    console.log(`   🤖 نام ربات: ${botInfo.first_name}`);
    console.log(`   📝 Username: @${botInfo.username}`);
    console.log(`   🆔 Bot ID: ${botInfo.id}`);
    
    console.log('\n📡 ربات در حال listening است...');
    console.log('   در تلگرام به ربات پیام بفرستید تا ببینید آیا دریافت می‌کند.\n');
    
    // لاگ تمام پیام‌ها
    bot.on('message', (msg) => {
      console.log(`\n📨 پیام دریافت شد:`);
      console.log(`   از: ${msg.from?.first_name} (@${msg.from?.username || 'no username'})`);
      console.log(`   متن: ${msg.text || '(non-text message)'}`);
      console.log(`   Chat ID: ${msg.chat.id}`);
      console.log(`   Telegram ID: ${msg.from.id}`);
    });
    
    // دستور /test
    bot.onText(/\/test/, (msg) => {
      console.log('\n✅ دستور /test دریافت شد!');
      bot.sendMessage(msg.chat.id, '✅ ربات کار می‌کند! این یک پیام تست است.');
    });
    
    // دستور /start
    bot.onText(/\/start/, (msg) => {
      console.log('\n✅ دستور /start دریافت شد!');
      bot.sendMessage(msg.chat.id, 
        '👋 سلام! ربات کار می‌کند.\n\n' +
        'دستورات:\n' +
        '/test - تست ربات\n' +
        '/start - شروع\n\n' +
        `📍 Telegram ID شما: ${msg.from.id}`
      );
    });
    
    console.log('\n⏳ برای توقف، Ctrl+C را فشار دهید\n');
    
  }).catch((error) => {
    console.error('\n❌ خطا در اتصال:');
    console.error(`   ${error.message}\n`);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.body, null, 2));
    }
    process.exit(1);
  });
  
  // مدیریت خطاها
  bot.on('polling_error', (error) => {
    console.error('\n❌ Polling error:', error.message);
  });
  
  bot.on('error', (error) => {
    console.error('\n❌ Bot error:', error.message);
  });
  
} catch (error) {
  console.error('\n❌ خطا در ایجاد ربات:');
  console.error(`   ${error.message}\n`);
  process.exit(1);
}


