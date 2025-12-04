import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found');
  process.exit(1);
}

console.log('🔍 تست ساده Handler /start...\n');

const bot = new TelegramBot(token, { polling: true });

// Handler برای /start - اول
bot.onText(/\/start/, (msg) => {
  console.log('\n✅ ===== /start HANDLER TRIGGERED =====');
  console.log(`   From: ${msg.from?.first_name || 'Unknown'}`);
  console.log(`   Telegram ID: ${msg.from?.id}`);
  console.log(`   Chat ID: ${msg.chat.id}`);
  console.log(`   Text: ${msg.text}`);
  console.log('=====================================\n');
  
  bot.sendMessage(msg.chat.id, 
    '✅ ربات کار می‌کند!\n\n' +
    'این یک پیام تست است.\n\n' +
    `📍 Telegram ID شما: ${msg.from.id}`
  ).then(() => {
    console.log('✅ پیام ارسال شد');
  }).catch((error) => {
    console.error('❌ خطا در ارسال پیام:', error.message);
  });
});

// لاگ تمام پیام‌ها - بعد
bot.on('message', (msg) => {
  console.log('\n📨 ===== MESSAGE RECEIVED =====');
  console.log(`   From: ${msg.from?.first_name || 'Unknown'}`);
  console.log(`   Telegram ID: ${msg.from?.id}`);
  console.log(`   Text: ${msg.text || '(no text)'}`);
  console.log('================================\n');
});

bot.getMe().then((botInfo) => {
  console.log('✅ ربات آماده است:');
  console.log(`   🤖 @${botInfo.username}`);
  console.log(`   📝 ${botInfo.first_name}`);
  console.log(`\n⏳ در حال انتظار برای پیام /start...`);
  console.log('   لطفاً در تلگرام /start بزنید\n');
}).catch((error) => {
  console.error('❌ خطا:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n⏹️  متوقف کردن...');
  bot.stopPolling();
  process.exit(0);
});


