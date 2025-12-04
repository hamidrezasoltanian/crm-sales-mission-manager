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

console.log('🔍 تست مستقیم Polling...\n');

const bot = new TelegramBot(token, { polling: true });

// Handler اول - برای لاگ تمام پیام‌ها
bot.on('message', (msg) => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📨 MESSAGE RECEIVED`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   From: ${msg.from?.first_name || 'Unknown'}`);
  console.log(`   Telegram ID: ${msg.from?.id}`);
  console.log(`   Chat ID: ${msg.chat.id}`);
  console.log(`   Text: ${msg.text || '(no text)'}`);
  console.log(`${'='.repeat(50)}\n`);
});

// Handler /start
bot.onText(/\/start/, (msg) => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ /start HANDLER TRIGGERED`);
  console.log(`${'='.repeat(50)}\n`);
  
  bot.sendMessage(msg.chat.id, '✅ ربات کار می‌کند!').then(() => {
    console.log('✅ پیام ارسال شد');
  }).catch((error) => {
    console.error('❌ خطا در ارسال پیام:', error.message);
  });
});

// بررسی polling status هر 5 ثانیه
setInterval(() => {
  if (bot.isPolling && typeof bot.isPolling === 'function') {
    const status = bot.isPolling();
    console.log(`📊 Polling status: ${status ? '✅ Active' : '❌ Inactive'}`);
  } else {
    console.log('⚠️ isPolling method not available');
  }
}, 5000);

bot.getMe().then((botInfo) => {
  console.log('✅ Bot آماده است:');
  console.log(`   🤖 @${botInfo.username}`);
  console.log(`   📝 ${botInfo.first_name}`);
  console.log(`\n⏳ در حال انتظار برای پیام /start...`);
  console.log('   لطفاً در تلگرام /start بزنید\n');
  
  // بررسی اولیه polling
  setTimeout(() => {
    if (bot.isPolling && typeof bot.isPolling === 'function') {
      const status = bot.isPolling();
      console.log(`📊 Polling status (after 2s): ${status ? '✅ Active' : '❌ Inactive'}`);
      if (!status) {
        console.log('🔄 Trying to restart polling...');
        bot.stopPolling().then(() => {
          return bot.startPolling();
        }).then(() => {
          console.log('✅ Polling restarted');
        }).catch((err) => {
          console.error('❌ Failed to restart:', err.message);
        });
      }
    }
  }, 2000);
}).catch((error) => {
  console.error('❌ خطا:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n⏹️  متوقف کردن...');
  bot.stopPolling();
  process.exit(0);
});

