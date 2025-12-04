import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found');
  process.exit(1);
}

console.log('🔍 تست Handler /start...\n');

const bot = new TelegramBot(token, { polling: true });

// لاگ تمام پیام‌ها
bot.on('message', (msg) => {
  console.log('\n📨 ===== MESSAGE RECEIVED =====');
  console.log(`   From: ${msg.from?.first_name || 'Unknown'}`);
  console.log(`   Telegram ID: ${msg.from?.id}`);
  console.log(`   Text: ${msg.text || '(no text)'}`);
  console.log(`   Chat ID: ${msg.chat.id}`);
  console.log('===============================\n');
});

// Handler برای /start
bot.onText(/\/start/, async (msg) => {
  console.log('\n✅ ===== /start HANDLER TRIGGERED =====');
  console.log(`   From: ${msg.from?.first_name || 'Unknown'}`);
  console.log(`   Telegram ID: ${msg.from?.id}`);
  console.log(`   Chat ID: ${msg.chat.id}`);
  console.log('=====================================\n');
  
  try {
    await bot.sendMessage(msg.chat.id, '✅ Handler /start کار می‌کند!');
    console.log('✅ پیام ارسال شد');
  } catch (error) {
    console.error('❌ خطا در ارسال پیام:', error.message);
  }
});

// تست اتصال
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

// نگه داشتن process
process.on('SIGINT', () => {
  console.log('\n\n⏹️  متوقف کردن...');
  bot.stopPolling();
  process.exit(0);
});


