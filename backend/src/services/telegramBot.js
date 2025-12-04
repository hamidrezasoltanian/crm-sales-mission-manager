import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cron from 'node-cron';
import { Personnel } from '../models/Personnel.js';
import { Center } from '../models/Center.js';
import { Assignment as AssignmentModel } from '../models/Assignment.js';
import { Contact } from '../models/Contact.js';
import { DiscountCode } from '../models/DiscountCode.js';
import { getDB } from '../config/database.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import jalaali from 'jalaali-js';
import { getCenterStatusHistory } from './utils/statusHistoryService.js';
import { HrApi } from './hrApi.js';
import { SpeechService } from './speechService.js';
import { AiRouter } from './aiRouter.js';
import workflowBoardService from './workflowBoardService.js';
const { toJalaali, toGregorian } = jalaali;

const STATUS_LABEL_MAP = {
  'lead': 'سرنخ',
  'opportunity': 'فرصت',
  'customer': 'مشتری',
  'old_customer': 'مشتری قدیمی',
  'سرنخ': 'سرنخ',
  'فرصت': 'فرصت',
  'مشتری': 'مشتری',
  'مشتری قدیمی': 'مشتری قدیمی'
};

const mapStatusLabel = (status) => {
  if (!status && status !== 0) {
    return 'بدون برچسب';
  }
  const raw = String(status).trim();
  if (STATUS_LABEL_MAP[raw]) {
    return STATUS_LABEL_MAP[raw];
  }
  const lower = raw.toLowerCase();
  if (STATUS_LABEL_MAP[lower]) {
    return STATUS_LABEL_MAP[lower];
  }
  return raw || 'بدون برچسب';
};

const PROVINCE_KEYWORDS = [
  'استان', 'استانی', 'شهرستان', 'شهرستانی', 'غیرتهران', 'شهر بیرون',
  'آذربایجان', 'اردبیل', 'اصفهان', 'البرز', 'ایلام', 'بوشهر', 'خراسان', 'خوزستان',
  'زنجان', 'سمنان', 'سیستان', 'بلوچستان', 'فارس', 'قزوین', 'قم', 'کردستان',
  'کرمان', 'کرمانشاه', 'کهگیلویه', 'گلستان', 'گیلان', 'لرستان', 'مازندران',
  'مرکزی', 'هرمزگان', 'همدان', 'یزد', 'چهارمحال', 'بیرجند', 'مشهد', 'تبریز',
  'شیراز', 'اصفهان', 'اهواز', 'اراک', 'زاهدان', 'سنندج', 'رشت', 'گرگان',
  'khorasan', 'isfahan', 'kerman', 'yazd', 'ardabil', 'gilan', 'mazandaran', 'bushehr',
  'province', 'provincial', 'city', 'county'
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

export class TelegramBotService {
  constructor() {
    this.bot = null;
    this.conversations = new Map(); // برای مدیریت conversation های کاربران
    this.aiRouter = null;
    this.speechService = null;
    
    // Initialize bot
    this.initialize();
  }

  resolveTerritoryId(centerId) {
    if (!centerId && centerId !== 0) {
      return null;
    }
    if (typeof centerId === 'string') {
      if (centerId.startsWith('mc_')) {
        return centerId;
      }
      return `mc_mission_${centerId}`;
    }
    return `mc_mission_${centerId}`;
  }

  async getCenterStatusTimelineText(centerId, limit = 5) {
    try {
      const territoryId = this.resolveTerritoryId(centerId);
      if (!territoryId) {
        return '';
      }

      const history = await getCenterStatusHistory(territoryId, limit);
      if (!history.length) {
        return '';
      }

      const formatter = new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      const lines = history.map(entry => {
        const prevLabel = mapStatusLabel(entry.previousStatus);
        const newLabel = mapStatusLabel(entry.newStatus);
        let dateLabel = '';
        if (entry.changedAt) {
          const parsedDate = new Date(entry.changedAt);
          if (!Number.isNaN(parsedDate.getTime())) {
            dateLabel = formatter.format(parsedDate);
          } else {
            dateLabel = entry.changedAt;
          }
        }
        const dateText = dateLabel || 'زمان نامشخص';
        return `• ${dateText}: ${prevLabel} ➡️ ${newLabel}`;
      });

      return `\n🕒 *سیر تبدیل:*\n${lines.join('\n')}`;
    } catch (error) {
      console.error('❌ Failed to load center status timeline:', error);
      return '';
    }
  }

  initialize() {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!token || token === 'your-telegram-bot-token-here' || !token.trim()) {
        console.error('❌ TELEGRAM_BOT_TOKEN not set or invalid');
        return;
      }

      console.log('🔧 Initializing Telegram bot...');
      this.usePolling = process.env.TELEGRAM_USE_POLLING !== 'false' && process.env.TELEGRAM_WEBHOOK_MODE !== 'true';
      const botOptions = this.usePolling ? { polling: true } : { polling: false };
      this.bot = new TelegramBot(token, botOptions);
      this.speechService = new SpeechService(this.bot);
      this.aiRouter = new AiRouter();
      
      console.log('✅ Bot instance created, setting up commands...');
      this.setupCommands();
      this.scheduleDailySnapReminder();
      console.log(this.usePolling
        ? '📡 Bot is running in polling mode.'
        : '🔌 Bot is running in gateway/webhook mode (processUpdate via API).');
      
      // Test connection
      this.bot.getMe().then((botInfo) => {
        console.log('✅ Telegram bot initialized successfully');
        console.log(`🤖 Bot Username: @${botInfo.username}`);
        console.log(`📝 Bot Name: ${botInfo.first_name}`);
        console.log('📡 Bot is ready to receive messages!');
      }).catch((error) => {
        console.error('❌ Telegram bot connection error:', error.message);
      });

      // Handle unhandled promise rejections
      process.on('unhandledRejection', (error) => {
        console.error('❌ Unhandled Promise Rejection in Telegram Bot:', error);
      });

    } catch (error) {
      console.error('❌ Error initializing Telegram bot:', error);
    }
  }

  setupCommands() {
    console.log('📋 Setting up bot commands...');
    console.log('🔧 Bot instance:', this.bot ? '✅ موجود' : '❌ موجود نیست');

    // ========== Command Handlers (onText) - باید قبل از on('message') باشند ==========
    // دستور /start - شروع کار با ربات
    console.log('📝 Registering /start handler...');
    this.bot.onText(/^\/start$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /start command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        
        if (!personnel) {
          await this.bot.sendMessage(chatId, 
            `❌ شما در سیستم ثبت نشده‌اید.\n\n` +
            `📍 Telegram ID شما: ${telegramId}\n\n` +
            `لطفاً با مدیر تماس بگیرید تا شما را در سیستم ثبت کند.`
          );
          return;
        }

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📋 ماموریت‌های من', callback_data: 'menu_missions' },
                { text: '➕ ماموریت جدید', callback_data: 'menu_newmission' }
              ],
              [
                { text: '👥 منابع انسانی', callback_data: 'menu_hr' },
                { text: '🏥 تاییدیه‌ها', callback_data: 'menu_medical' }
              ],
              [
                { text: '📊 گزارش شخصی', callback_data: 'menu_report' },
                { text: '📝 تکمیل اطلاعات مرکز', callback_data: 'menu_complete_center' }
              ],
              [
                { text: '📞 تماس‌های استان‌ها', callback_data: 'menu_province_contact' },
                { text: '📞 تماس‌های تهران', callback_data: 'menu_tehran_contact' }
              ],
              ...(personnel.role === 'admin' || personnel.role === 'manager' ? [[
                { text: '⏳ در انتظار تایید', callback_data: 'menu_pending' },
                { text: '⚙️ مدیریت مراکز', callback_data: 'menu_manage_centers' }
              ]] : []),
              [
                { text: '❓ راهنما', callback_data: 'menu_help' }
              ]
            ]
          }
        };

        const personnelName = (personnel.name || 'کاربر').replace(/[*_`\[\]()]/g, '');
        const isManager = personnel.role === 'admin' || personnel.role === 'manager';
        
        const baseSections = [
          `👋 سلام ${personnelName}!`,
          ``,
          `🚀 *ماموریت‌ها*`,
          `• /missions – فهرست مأموریت‌های من`,
          `• /newmission – ایجاد مأموریت جدید`,
          `• /status_<id> – مشاهده جزئیات یا ثبت هزینه اسنپ یک مأموریت`,
          `• /report – گزارش عملکرد و آمار شخصی`,
          `• /complete_center – تکمیل اطلاعات مرکز انتخاب‌شده`,
          `• دکمه «↩️ بازگشت به شرکت» برای ثبت مأموریت داخلی و هزینه اسنپ`,
          ``,
          `📞 *تماس‌ها و مراکز*`,
          `• از دکمه‌های «📞 تماس‌های استان‌ها» و «📞 تماس‌های تهران» برای جستجو، مشاهده مأموریت‌های مرکز و ثبت/ویرایش مخاطب استفاده کنید.`,
          `• در هر مرکز می‌توانید شماره‌ها، آدرس‌ها و تحویل‌گیرنده‌ها را ویرایش یا اضافه کنید.`,
          ``,
          `👥 *منابع انسانی*`,
          `• دکمه «👥 منابع انسانی» برای ثبت مرخصی، حضور/غیاب، مشاهده فیش حقوقی و وضعیت درخواست‌ها.`,
          `• درخواست‌های مرخصی پس از ثبت برای مدیران ارسال می‌شود و وضعیت آن را می‌توانید در همین منو ببینید.`,
          ``,
          `🏥 *تاییدیه‌های پزشکی*`,
          `• با دکمه «🏥 تاییدیه‌ها» می‌توانید فایل‌های پزشکی را آپلود کنید، دسته‌بندی بسازید یا لیست تاییدیه‌های ارسال‌شده را ببینید.`,
          ``,
          `ℹ️ *راهنما*`,
          `• /help – دریافت توضیحات کامل، راهنمای خطاها و میانبرهای بیشتر`
        ];
        
        let welcomeMessage = baseSections.join('\n');
        
        if (isManager) {
          const managerSection = [
            ``,
            `🛠 *دستورات ویژه مدیران*`,
            `• /manage_centers – فیلتر و تغییر وضعیت مراکز، اختصاص مسئول`,
            `• /add – افزودن مرکز جدید`,
            `• /pending – تایید یا رد مأموریت‌های در انتظار`,
            `• در بخش «👥 منابع انسانی» فهرست مرخصی‌های در انتظار نمایش داده می‌شود و می‌توانید همان‌جا تایید یا رد کنید.`
          ].join('\n');
          welcomeMessage += managerSection;
        }

        await this.bot.sendMessage(chatId, welcomeMessage, keyboard);
        console.log('✅ Welcome message sent successfully');
      } catch (error) {
        console.error('❌ Error in /start:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });

    // دستور /missions - لیست ماموریت‌های کاربر
    console.log('📝 Registering /missions handler...');
    this.bot.onText(/^\/missions$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /missions command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        const assignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
        
        if (assignments.length === 0) {
          await this.bot.sendMessage(chatId, '📋 شما هنوز ماموریتی ندارید.\n\nبرای ایجاد ماموریت جدید از /newmission استفاده کنید.');
          return;
        }

        // استفاده از Pagination
        await this.showMissionsList(chatId, assignments, 0, 'missions_page');
      } catch (error) {
        console.error('❌ Error in /missions:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });

    // دستور /newmission - ایجاد ماموریت جدید
    this.bot.onText(/^\/newmission$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /newmission command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        const companyCenter = await this.getOrCreateCompanyCenter();
        const companyCenterId = companyCenter ? parseInt(companyCenter.id) : null;

        // بررسی ماموریت‌های بدون هزینه اسنپ که باید تکمیل شوند
        // فقط ماموریت‌های approved یا completed که snapCost صفر یا null است
        const allAssignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
        
        console.log(`🔍 Checking incomplete snap costs for personnel ${personnel.id}:`);
        console.log(`   Total assignments: ${allAssignments.length}`);
        
        // لاگ تمام ماموریت‌های approved و completed
        const approvedOrCompleted = allAssignments.filter(a => a.status === 'approved' || a.status === 'completed');
        console.log(`   Approved/Completed assignments: ${approvedOrCompleted.length}`);
        approvedOrCompleted.forEach(a => {
          console.log(`   - Assignment #${a.id}: status=${a.status}, snapCost=${a.snapCost} (type: ${typeof a.snapCost}, value: ${JSON.stringify(a.snapCost)})`);
        });
        
        const incompleteSnapCost = allAssignments.filter(a => {
          if (companyCenterId && parseInt(a.centerId) === companyCenterId) {
            return false;
          }
          const snapCostValue = a.snapCost;
          // تبدیل به number برای مقایسه
          const snapCostNum = snapCostValue === null || snapCostValue === undefined ? 0 : Number(snapCostValue);
          const hasNoSnapCost = this.isSnapCostMissing(snapCostValue);
          const isApprovedOrCompleted = a.status === 'approved' || a.status === 'completed';
          
          if (isApprovedOrCompleted) {
            console.log(`   Checking assignment #${a.id}: status=${a.status}, snapCost=${snapCostValue} (parsed: ${snapCostNum}), hasNoSnapCost=${hasNoSnapCost}`);
          }
          
          return isApprovedOrCompleted && hasNoSnapCost;
        });
        
        console.log(`   Incomplete snap costs: ${incompleteSnapCost.length}`);
        if (incompleteSnapCost.length > 0) {
          incompleteSnapCost.forEach(a => {
            console.log(`   ✓ Incomplete: Assignment #${a.id}: status=${a.status}, snapCost=${a.snapCost}`);
          });
        } else {
          console.log(`   ✓ No incomplete snap costs found`);
        }

        if (incompleteSnapCost.length > 0) {
          // نمایش ماموریت‌های بدون هزینه اسنپ و جلوگیری از ایجاد ماموریت جدید
          let message = `⚠️ ماموریت‌های بدون هزینه اسنپ\n\n`;
          message += `شما ${incompleteSnapCost.length} ماموریت دارید که هزینه اسنپ آن‌ها ثبت نشده است.\n\n`;
          message += `❌ برای ایجاد ماموریت جدید، ابتدا باید هزینه اسنپ همه ماموریت‌های قبلی را تکمیل کنید.\n\n`;
          message += `📋 ماموریت‌های بدون هزینه اسنپ:\n\n`;

          incompleteSnapCost.slice(0, 10).forEach((assignment, index) => {
            const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
            const statusLabel = this.getStatusLabel(assignment.status);
            message += `${index + 1}. ماموریت #${assignment.id} - ${centerName} (${statusLabel})\n`;
          });

          if (incompleteSnapCost.length > 10) {
            message += `\nو ${incompleteSnapCost.length - 10} ماموریت دیگر...\n`;
          }

          message += `\n💡 برای تکمیل هزینه اسنپ، روی هر ماموریت کلیک کنید یا از /status_<id> استفاده کنید.`;

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                ...incompleteSnapCost.slice(0, 10).map(a => {
                  const centerName = (a.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
                  return [{ text: `📋 ماموریت #${a.id} - ${centerName}`, callback_data: `add_snapcost_${a.id}` }];
                })
              ]
            }
          };

          await this.bot.sendMessage(chatId, message, { ...keyboard });
          return;
        }
        // بررسی اینکه آیا کاربر مدیر است
        const isManager = personnel.role === 'admin' || personnel.role === 'manager';
        // شروع conversation برای انتخاب مراکز
        this.conversations.set(chatId, {
          step: 'center_selection',
          personnelId: personnel.id,
          data: {
            selectedCenters: [], // لیست مراکز انتخاب شده
            typeFilter: null, // فیلتر نوع مرکز
            responsibleFilter: null // فیلتر مسئول (فقط برای مدیران)
          }
        });

        // نمایش لیست کامل مراکز با جستجو
        await this.showCentersList(chatId, 0, '', null, null, isManager);
      } catch (error) {
        console.error('❌ Error in /newmission:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
        this.conversations.delete(chatId);
      }
    });

    // دستور /status - راهنما
    this.bot.onText(/^\/status$/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId,
        `📋 راهنمای استفاده از /status\n\n` +
        `برای مشاهده جزئیات یک ماموریت:\n` +
        `/status_1 - نمایش جزئیات ماموریت شماره 1\n` +
        `/status 1 - همان (با فاصله)\n\n` +
        `💡 عدد را با ID ماموریت جایگزین کنید.`
      );
    });

    // دستور /status <id> - نمایش جزئیات ماموریت
    this.bot.onText(/^\/status\s+(\d+)$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const assignmentId = parseInt(match[1]);
      await this.handleStatusCommand(chatId, assignmentId, msg.from.id.toString());
    });

    // دستور /status_<id> - نمایش جزئیات ماموریت (با underscore)
    this.bot.onText(/^\/status_(\d+)$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const assignmentId = parseInt(match[1]);
      await this.handleStatusCommand(chatId, assignmentId, msg.from.id.toString());
    });

    // دستور /report - گزارش شخصی
    this.bot.onText(/^\/report$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /report command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        const isManager = personnel.role === 'admin' || personnel.role === 'manager';

        const assignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });

        // محاسبه آمار
        const total = assignments.length;
        const pending = assignments.filter(a => a.status === 'pending').length;
        const approved = assignments.filter(a => a.status === 'approved').length;
        const completed = assignments.filter(a => a.status === 'completed').length;
        const totalCost = assignments.reduce((sum, a) => sum + (a.totalCost || 0), 0);
        const totalPersonalPayment = assignments.reduce((sum, a) => sum + (a.personalPayment || 0), 0);

        let message = `📊 گزارش شخصی شما\n\n`;
        message += `📋 آمار کلی:\n`;
        message += `   • کل ماموریت‌ها: ${total}\n`;
        message += `   • در انتظار: ${pending}\n`;
        message += `   • تایید شده: ${approved}\n`;
        message += `   • تکمیل شده: ${completed}\n\n`;
        message += `💰 هزینه‌ها:\n`;
        message += `   • مجموع هزینه کل: ${totalCost.toLocaleString('fa-IR')} تومان\n`;
        message += `   • مجموع پرداخت شخصی: ${totalPersonalPayment.toLocaleString('fa-IR')} تومان\n\n`;
        message += `💡 برای جزئیات بیشتر از /missions استفاده کنید.`;

        // اگر مدیر است، گزارش بر اساس نوع مرکز را اضافه کن
        if (isManager) {
          const centers = await Center.getAll({ isActive: true });
          const typeStats = {
            'lead': 0,
            'opportunity': 0,
            'customer': 0,
            'old_customer': 0
          };

          centers.forEach(c => {
            if (c.type && typeStats.hasOwnProperty(c.type)) {
              typeStats[c.type]++;
            }
          });

          const typeLabels = {
            'lead': '⚪ سرنخ',
            'opportunity': '🟡 فرصت',
            'customer': '🟢 مشتری',
            'old_customer': '🔵 مشتری قدیمی'
          };

          message += `\n\n📊 آمار مراکز بر اساس نوع:\n`;
          Object.keys(typeStats).forEach(type => {
            message += `   ${typeLabels[type]}: ${typeStats[type]} مرکز\n`;
          });
        }

        await this.bot.sendMessage(chatId, message);
      } catch (error) {
        console.error('❌ Error in /report:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });

    // دستور /add - افزودن مرکز جدید (فقط برای مدیران)
    this.bot.onText(/^\/add$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /add command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        // فقط مدیران می‌توانند مرکز اضافه کنند
        if (personnel.role !== 'admin' && personnel.role !== 'manager') {
          await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند مرکز اضافه کنند.');
          return;
        }

        // شروع conversation برای افزودن مرکز
        this.conversations.set(chatId, {
          step: 'add_center_name',
          personnelId: personnel.id,
          data: {}
        });

        await this.bot.sendMessage(chatId, 
          `➕ افزودن مرکز جدید\n\n` +
          `مرحله 1️⃣: نام مرکز\n\n` +
          `لطفاً نام مرکز را وارد کنید:`
        );
      } catch (error) {
        console.error('❌ Error in /add:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
        this.conversations.delete(chatId);
      }
    });

    // دستور /manage_centers - مدیریت مراکز (فقط برای مدیران)
    this.bot.onText(/^\/manage_centers$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /manage_centers command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        const isManager = personnel.role === 'admin' || personnel.role === 'manager';
        if (!isManager) {
          await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند مراکز را مدیریت کنند.');
          return;
        }

        await this.showManageCentersMenu(chatId, 0);
      } catch (error) {
        console.error('❌ Error in /manage_centers:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });
    // دستور /change_type - تغییر نوع مرکز
    this.bot.onText(/^\/change_type\s+(\d+)$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      const centerId = parseInt(match[1]);
      
      console.log(`📥 /change_type ${centerId} command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        const isManager = personnel.role === 'admin' || personnel.role === 'manager';
        if (!isManager) {
          await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند نوع مرکز را تغییر دهند.');
          return;
        }

        await this.showChangeTypeMenu(chatId, centerId);
      } catch (error) {
        console.error('❌ Error in /change_type:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });

    // دستور /assign_center - اختصاص مرکز به کارمند
    this.bot.onText(/^\/assign_center\s+(\d+)$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      const centerId = parseInt(match[1]);
      
      console.log(`📥 /assign_center ${centerId} command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        const isManager = personnel.role === 'admin' || personnel.role === 'manager';
        if (!isManager) {
          await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند مرکز را به کارمند اختصاص دهند.');
          return;
        }

        await this.showAssignCenterMenu(chatId, centerId);
      } catch (error) {
        console.error('❌ Error in /assign_center:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });

    // دستور /complete_center - تکمیل اطلاعات مرکز
    this.bot.onText(/^\/complete_center$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /complete_center command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        // پیدا کردن مراکزی که اطلاعات کامل ندارند
        const allCenters = await Center.getAll();
        const incompleteCenters = allCenters.filter(c => !c.address || !c.city);

        if (incompleteCenters.length === 0) {
          await this.bot.sendMessage(chatId, '✅ همه مراکز اطلاعات کامل دارند!');
          return;
        }

        // شروع conversation
        this.conversations.set(chatId, {
          step: 'complete_center_selection',
          personnelId: personnel.id,
          data: {}
        });

        // نمایش لیست مراکز ناقص با pagination
        await this.handleCompleteCenterStart(chatId);
      } catch (error) {
        console.error('❌ Error in /complete_center:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
        this.conversations.delete(chatId);
      }
    });
    // دستور /pending - لیست ماموریت‌های در انتظار تایید (فقط مدیران)
    this.bot.onText(/^\/pending$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      
      console.log(`📥 /pending command received from ${telegramId}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        if (!personnel) {
          await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
          return;
        }

        const isManager = personnel.role === 'admin' || personnel.role === 'manager';
        if (!isManager) {
          await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند این دستور را استفاده کنند.');
          return;
        }

        const pendingAssignments = await AssignmentModel.getAll({ status: 'pending' });
        
        if (pendingAssignments.length === 0) {
          await this.bot.sendMessage(chatId, '✅ هیچ ماموریتی در انتظار تایید نیست.');
          return;
        }

        // نمایش هر ماموریت با دکمه‌های تایید/رد
        for (const assignment of pendingAssignments.slice(0, 10)) {
          const personnel = await Personnel.getById(assignment.personnelId);
          const center = await Center.getById(assignment.centerId);
          const personnelName = (personnel?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');

          // اطمینان از اینکه ID به درستی استفاده می‌شود
          const assignmentId = assignment.id || assignment._id;
          console.log(`[Pending] Assignment ID: ${assignmentId} (type: ${typeof assignmentId}), assignment object:`, { id: assignment.id, _id: assignment._id });

          let message = `⏳ ماموریت در انتظار تایید\n\n`;
          message += `📋 کد ماموریت: #${assignmentId}\n`;
          message += `👤 پرسنل: ${personnelName}\n`;
          message += `🏢 مرکز: ${centerName}\n`;
          
          // اضافه کردن یادداشت‌های مرکز اگر وجود داشته باشد
          if (assignment.notes) {
            const notes = (assignment.notes || '').replace(/[*_`\[\]()]/g, '');
            message += `📝 یادداشت: ${notes}\n`;
          }
          
          if (assignment.totalCost) {
            message += `💰 هزینه کل: ${assignment.totalCost.toLocaleString('fa-IR')} تومان\n`;
          }

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ تایید', callback_data: `approve_${assignmentId}` },
                  { text: '❌ رد', callback_data: `reject_${assignmentId}` }
                ],
                [
                  { text: '📋 جزئیات', callback_data: `status_${assignmentId}` }
                ]
              ]
            }
          };

          await this.bot.sendMessage(chatId, message, keyboard);
        }

        if (pendingAssignments.length > 10) {
          await this.bot.sendMessage(chatId, `\nو ${pendingAssignments.length - 10} ماموریت دیگر در انتظار تایید است.`);
        }
      } catch (error) {
        console.error('❌ Error in /pending:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });

    // دستور /approve - راهنما
    this.bot.onText(/^\/approve$/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId,
        `📋 راهنمای استفاده از /approve\n\n` +
        `برای تایید یک ماموریت:\n` +
        `/approve_1 - تایید ماموریت شماره 1\n\n` +
        `💡 عدد را با ID ماموریت جایگزین کنید.\n` +
        `💡 یا از /pending استفاده کنید و دکمه تایید را بزنید.`
      );
    });

    // دستور /approve_<id> - تایید ماموریت
    this.bot.onText(/^\/approve_(\d+)$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const assignmentId = parseInt(match[1]);
      await this.handleApprove(chatId, assignmentId, msg.from.id.toString());
    });
    // دستور /help - راهنمای کامل
    this.bot.onText(/^\/help$/, async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from.id.toString();
      console.log(`📥 /help command received from ${msg.from?.id || 'Unknown'}`);
      
      try {
        const personnel = await Personnel.getByTelegramId(telegramId);
        const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');

        let helpMessage = `📖 راهنمای دستورات\n\n`;
        helpMessage += `دستورات عمومی:\n`;
        helpMessage += `/start - شروع کار با ربات و نمایش منو\n`;
        helpMessage += `/missions - لیست ماموریت‌های من\n`;
        helpMessage += `/newmission - ایجاد ماموریت جدید (step-by-step)\n`;
        helpMessage += `/status_<id> - نمایش جزئیات ماموریت\n`;
        helpMessage += `/report - گزارش‌های شخصی\n`;
        helpMessage += `/complete_center - تکمیل اطلاعات مرکز\n`;
        helpMessage += `/help - نمایش این راهنما\n\n`;

        if (isManager) {
          helpMessage += `دستورات مدیران:\n`;
          helpMessage += `/add - افزودن مرکز جدید\n`;
          helpMessage += `/manage_centers - مدیریت مراکز (تغییر نوع و اختصاص به کارمند)\n`;
          helpMessage += `/change_type <id> - تغییر نوع مرکز\n`;
          helpMessage += `/assign_center <id> - اختصاص مرکز به کارمند\n`;
          helpMessage += `/pending - لیست ماموریت‌های در انتظار تایید\n`;
          helpMessage += `/approve_<id> - تایید ماموریت\n\n`;
        }

        helpMessage += `💡 نکته: برای استفاده از دستورات با ID، عدد را جایگزین <id> کنید.\n`;
        helpMessage += `مثال: /status_1 برای مشاهده ماموریت شماره 1`;

        await this.bot.sendMessage(chatId, helpMessage);
      } catch (error) {
        console.error('❌ Error in /help:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });
    // ========== Callback Query Handlers (Inline Keyboard) ==========
    console.log('📝 Registering callback_query handler...');
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const data = query.data;
      const msg = query.message;
      const telegramId = query.from.id.toString();

      console.log(`📥 Callback query received from ${telegramId}: ${data}`);

      try {
        await this.bot.answerCallbackQuery(query.id);

        const hrResult = await this.handleHrCallback(query);
        if (hrResult) {
          console.log(`[Callback] handleHrCallback returned true for: ${data}`);
          return;
        }

        const aiCenterHandled = await this.handleAiCenterCallback(query);
        if (aiCenterHandled) {
          return;
        }

        const aiContactRegionHandled = await this.handleAiContactRegionCallback(query);
        if (aiContactRegionHandled) {
          return;
        }

        // Handle menu items - مستقیماً handler ها را فراخوانی می‌کنیم
        if (data === 'menu_missions') {
          console.log('🔘 Menu button: missions');
          const msgObj = { chat: { id: chatId }, from: { id: parseInt(telegramId) } };
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const assignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
          
          if (assignments.length === 0) {
            await this.bot.sendMessage(chatId, '📋 شما هنوز ماموریتی ندارید.\n\nبرای ایجاد ماموریت جدید از /newmission استفاده کنید.');
            return;
          }

          // استفاده از Pagination
          await this.showMissionsList(chatId, assignments, 0, 'missions_page');
          return;
        }

        // Handle pagination for missions
        if (data.startsWith('missions_page_')) {
          await this.bot.answerCallbackQuery(query.id);
          const page = parseInt(data.split('_')[2]) || 0;
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const assignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
          await this.showMissionsList(chatId, assignments, page, 'missions_page');
          return;
        }

        if (data === 'menu_newmission') {
          console.log('🔘 Menu button: newmission');
          const msgObj = { chat: { id: chatId }, from: { id: parseInt(telegramId) } };
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          // بررسی ماموریت‌های بدون هزینه اسنپ که باید تکمیل شوند
          const allAssignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
          const companyCenter = await this.getOrCreateCompanyCenter();
          const companyCenterId = companyCenter ? parseInt(companyCenter.id) : null;
          const incompleteSnapCost = allAssignments.filter(a => {
            if (companyCenterId && parseInt(a.centerId) === companyCenterId) {
              return false;
            }
            const snapCostValue = a.snapCost;
            // تبدیل به number برای مقایسه
            const snapCostNum = snapCostValue === null || snapCostValue === undefined ? 0 : Number(snapCostValue);
            const hasNoSnapCost = this.isSnapCostMissing(snapCostValue);
            return (a.status === 'approved' || a.status === 'completed') && hasNoSnapCost;
          });

          if (incompleteSnapCost.length > 0) {
            // نمایش ماموریت‌های بدون هزینه اسنپ و جلوگیری از ایجاد ماموریت جدید
            let message = `⚠️ ماموریت‌های بدون هزینه اسنپ\n\n`;
            message += `شما ${incompleteSnapCost.length} ماموریت دارید که هزینه اسنپ آن‌ها ثبت نشده است.\n\n`;
            message += `❌ برای ایجاد ماموریت جدید، ابتدا باید هزینه اسنپ همه ماموریت‌های قبلی را تکمیل کنید.\n\n`;
            message += `📋 ماموریت‌های بدون هزینه اسنپ:\n\n`;

            incompleteSnapCost.slice(0, 10).forEach((assignment, index) => {
              const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
              const statusLabel = this.getStatusLabel(assignment.status);
              message += `${index + 1}. ماموریت #${assignment.id} - ${centerName} (${statusLabel})\n`;
            });

            if (incompleteSnapCost.length > 10) {
              message += `\nو ${incompleteSnapCost.length - 10} ماموریت دیگر...\n`;
            }

            message += `\n💡 برای تکمیل هزینه اسنپ، روی هر ماموریت کلیک کنید یا از /status_<id> استفاده کنید.`;

            const keyboard = {
              reply_markup: {
                inline_keyboard: [
                  ...incompleteSnapCost.slice(0, 10).map(a => {
                    const centerName = (a.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
                    return [{ text: `📋 ماموریت #${a.id} - ${centerName}`, callback_data: `add_snapcost_${a.id}` }];
                  })
                ]
              }
            };

            await this.bot.sendMessage(chatId, message, { ...keyboard });
            return;
          }

          // بررسی اینکه آیا کاربر مدیر است
          const isManager = personnel.role === 'admin' || personnel.role === 'manager';

          // پاک کردن conversation قبلی برای شروع مجدد
          this.conversations.delete(chatId);

          // شروع conversation برای انتخاب مراکز
          this.conversations.set(chatId, {
            step: 'center_selection',
            personnelId: personnel.id,
            data: {
              selectedCenters: [],
              typeFilter: null,
              responsibleFilter: null
            }
          });

          // نمایش لیست کامل مراکز با جستجو
          await this.showCentersList(chatId, 0, '', null, null, isManager);
          return;
        }
        if (data === 'menu_back_to_company') {
          await this.bot.answerCallbackQuery(query.id);
          console.log('🔘 Menu button: back_to_company');
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const companyCenter = await this.getOrCreateCompanyCenter();
          const companyCenterId = companyCenter ? parseInt(companyCenter.id) : null;

          // بررسی ماموریت‌های بدون هزینه اسنپ که باید تکمیل شوند
          const allAssignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
          const incompleteSnapCost = allAssignments.filter(a => {
            if (companyCenterId && parseInt(a.centerId) === companyCenterId) {
              return false;
            }
            const snapCostValue = a.snapCost;
            const snapCostNum = snapCostValue === null || snapCostValue === undefined ? 0 : Number(snapCostValue);
            const hasNoSnapCost = this.isSnapCostMissing(snapCostValue);
            return (a.status === 'approved' || a.status === 'completed') && hasNoSnapCost;
          });

          if (incompleteSnapCost.length > 0) {
            let message = `⚠️ ماموریت‌های بدون هزینه اسنپ\n\n`;
            message += `شما ${incompleteSnapCost.length} ماموریت دارید که هزینه اسنپ آن‌ها ثبت نشده است.\n\n`;
            message += `❌ برای ایجاد ماموریت جدید، ابتدا باید هزینه اسنپ همه ماموریت‌های قبلی را تکمیل کنید.\n\n`;
            message += `📋 ماموریت‌های بدون هزینه اسنپ:\n\n`;

            incompleteSnapCost.slice(0, 10).forEach((assignment, index) => {
              const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
              const statusLabel = this.getStatusLabel(assignment.status);
              message += `${index + 1}. ماموریت #${assignment.id} - ${centerName} (${statusLabel})\n`;
            });

            if (incompleteSnapCost.length > 10) {
              message += `\nو ${incompleteSnapCost.length - 10} ماموریت دیگر...\n`;
            }

            message += `\n💡 برای تکمیل هزینه اسنپ، روی هر ماموریت کلیک کنید یا از /status_<id> استفاده کنید.`;

            const keyboard = {
              reply_markup: {
                inline_keyboard: [
                  ...incompleteSnapCost.slice(0, 10).map(a => {
                    const centerName = (a.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
                    return [{ text: `📋 ماموریت #${a.id} - ${centerName}`, callback_data: `add_snapcost_${a.id}` }];
                  })
                ]
              }
            };

            await this.bot.sendMessage(chatId, message, { ...keyboard });
            return;
          }

          if (!companyCenterId) {
            await this.bot.sendMessage(chatId, '❌ مرکز شرکت یافت نشد.');
            return;
          }

          await this.createCompanyReturnMission(chatId, personnel, companyCenter);
          return;
        }

        if (data === 'menu_report') {
          console.log('🔘 Menu button: report');
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 گزارش شخصی', callback_data: 'report_personal' }],
                [{ text: '📅 گزارش هفتگی', callback_data: 'report_weekly' }],
                [{ text: '📆 گزارش ماهانه', callback_data: 'report_monthly' }],
                ...(isManager ? [
                  [{ text: '📅 گزارش هفتگی کارمند', callback_data: 'report_weekly_personnel' }],
                  [{ text: '📆 گزارش ماهانه کارمند', callback_data: 'report_monthly_personnel' }]
                ] : [])
              ]
            }
          };
          
          await this.bot.sendMessage(chatId, 
            '📊 انتخاب نوع گزارش:\n\n' +
            '📊 گزارش شخصی: آمار کلی ماموریت‌های شما\n' +
            '📅 گزارش هفتگی: ماموریت‌های هفته جاری\n' +
            '📆 گزارش ماهانه: ماموریت‌های ماه جاری\n' +
            (isManager ? 
              '📅 گزارش هفتگی کارمند: گزارش هفتگی کارمند خاص\n' +
              '📆 گزارش ماهانه کارمند: گزارش ماهانه کارمند خاص\n' : ''),
            keyboard
          );
          return;
        }

        if (data === 'report_personal') {
          console.log('🔘 Report: personal');
          await this.bot.answerCallbackQuery(query.id);
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          try {
            const assignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });

            // محاسبه آمار
            const total = assignments.length;
            const pending = assignments.filter(a => a.status === 'pending').length;
            const approved = assignments.filter(a => a.status === 'approved').length;
            const completed = assignments.filter(a => a.status === 'completed').length;
            const totalCost = assignments.reduce((sum, a) => sum + (a.totalCost || 0), 0);
            const totalPersonalPayment = assignments.reduce((sum, a) => sum + (a.personalPayment || 0), 0);

            let message = `📊 گزارش شخصی شما\n\n`;
            message += `📋 آمار کلی:\n`;
            message += `   • کل ماموریت‌ها: ${total}\n`;
            message += `   • در انتظار: ${pending}\n`;
            message += `   • تایید شده: ${approved}\n`;
            message += `   • تکمیل شده: ${completed}\n\n`;
            message += `💰 هزینه‌ها:\n`;
            message += `   • مجموع هزینه کل: ${totalCost.toLocaleString('fa-IR')} تومان\n`;
            message += `   • مجموع پرداخت شخصی: ${totalPersonalPayment.toLocaleString('fa-IR')} تومان\n\n`;
            message += `💡 برای جزئیات بیشتر از /missions استفاده کنید.`;

            await this.bot.sendMessage(chatId, message);
          } catch (error) {
            console.error('Error generating personal report:', error);
            await this.bot.sendMessage(chatId, `❌ خطا در تهیه گزارش شخصی: ${error.message}`);
          }
          return;
        }

        if (data === 'report_weekly') {
          console.log('🔘 Report: weekly');
          await this.bot.answerCallbackQuery(query.id);
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          try {
            const now = new Date();
            const startDate = startOfWeek(now, { weekStartsOn: 6 });
            const endDate = endOfWeek(now, { weekStartsOn: 6 });
            const allAssignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
            const weeklyAssignments = this.filterAssignmentsWithinRange(allAssignments, startDate, endDate);

            const message = this.buildRangeReportMessage({
              title: '📅 گزارش هفتگی شما',
              startDate,
              endDate,
              assignments: weeklyAssignments,
              limit: 15
            });

            await this.bot.sendMessage(chatId, message);
          } catch (error) {
            console.error('❌ Error generating weekly report:', error);
            await this.bot.sendMessage(chatId, `❌ خطا در تهیه گزارش هفتگی: ${error.message}`);
          }
          return;
        }
        if (data === 'report_weekly_personnel') {
          console.log('🔘 Report: weekly personnel');
          await this.bot.answerCallbackQuery(query.id);
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ این دستور فقط برای مدیران است.');
            return;
          }

          // دریافت لیست کارمندان
          const allPersonnel = (await Personnel.getAll()).filter(p => p.isActive && p.role === 'staff');
          
          if (allPersonnel.length === 0) {
            await this.bot.sendMessage(chatId, '❌ هیچ کارمندی یافت نشد.');
            return;
          }

          // ایجاد لیست کشویی (Inline Keyboard)
          const keyboard = {
            inline_keyboard: []
          };

          // تقسیم کارمندان به ردیف‌های 2 تایی
          for (let i = 0; i < allPersonnel.length; i += 2) {
            const row = [];
            row.push({
              text: allPersonnel[i].name,
              callback_data: `report_weekly_personnel_${allPersonnel[i].id}`
            });
            if (i + 1 < allPersonnel.length) {
              row.push({
                text: allPersonnel[i + 1].name,
                callback_data: `report_weekly_personnel_${allPersonnel[i + 1].id}`
              });
            }
            keyboard.inline_keyboard.push(row);
          }

          keyboard.inline_keyboard.push([
            { text: '🔙 بازگشت', callback_data: 'menu_report' }
          ]);

          await this.bot.sendMessage(chatId, 
            '📅 گزارش هفتگی کارمند\n\n' +
            'لطفاً کارمند مورد نظر را انتخاب کنید:',
            { reply_markup: keyboard }
          );
          return;
        }

        // Handle report_weekly_personnel_${id}
        if (data.startsWith('report_weekly_personnel_')) {
          await this.bot.answerCallbackQuery(query.id);
          const personnelId = parseInt(data.replace('report_weekly_personnel_', ''));
          const selectedPersonnel = await Personnel.getById(personnelId);
          
          if (!selectedPersonnel) {
            await this.bot.sendMessage(chatId, '❌ کارمند یافت نشد.');
            return;
          }

          try {
            const now = new Date();
            const startDate = startOfWeek(now, { weekStartsOn: 6 });
            const endDate = endOfWeek(now, { weekStartsOn: 6 });
            const assignments = await AssignmentModel.getAll({ personnelId });
            const weeklyAssignments = this.filterAssignmentsWithinRange(assignments, startDate, endDate);

            const message = this.buildRangeReportMessage({
              title: '📅 گزارش هفتگی کارمند',
              startDate,
              endDate,
              assignments: weeklyAssignments,
              personnelName: selectedPersonnel.name,
              limit: 20
            });

            await this.bot.sendMessage(chatId, message);
          } catch (error) {
            console.error('❌ Error generating weekly personnel report:', error);
            await this.bot.sendMessage(chatId, `❌ خطا در تهیه گزارش هفتگی کارمند: ${error.message}`);
          }
          return;
        }

        // Handle report_monthly_personnel_${id}
        if (data.startsWith('report_monthly_personnel_')) {
          await this.bot.answerCallbackQuery(query.id);
          const personnelId = parseInt(data.replace('report_monthly_personnel_', ''));
          const selectedPersonnel = await Personnel.getById(personnelId);
          
          if (!selectedPersonnel) {
            await this.bot.sendMessage(chatId, '❌ کارمند یافت نشد.');
            return;
          }

          try {
            const now = new Date();
            const startDate = startOfMonth(now);
            const endDate = endOfMonth(now);
            const assignments = await AssignmentModel.getAll({ personnelId });
            const monthlyAssignments = this.filterAssignmentsWithinRange(assignments, startDate, endDate);

            const message = this.buildRangeReportMessage({
              title: '📆 گزارش ماهانه کارمند',
              startDate,
              endDate,
              assignments: monthlyAssignments,
              personnelName: selectedPersonnel.name,
              limit: 20
            });

            await this.bot.sendMessage(chatId, message);
          } catch (error) {
            console.error('❌ Error generating monthly personnel report:', error);
            await this.bot.sendMessage(chatId, `❌ خطا در تهیه گزارش ماهانه کارمند: ${error.message}`);
          }
          return;
        }

        if (data === 'report_monthly') {
          console.log('🔘 Report: monthly');
          await this.bot.answerCallbackQuery(query.id);
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          try {
            const now = new Date();
            const startDate = startOfMonth(now);
            const endDate = endOfMonth(now);
            const allAssignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
            const monthlyAssignments = this.filterAssignmentsWithinRange(allAssignments, startDate, endDate);

            const message = this.buildRangeReportMessage({
              title: '📆 گزارش ماهانه شما',
              startDate,
              endDate,
              assignments: monthlyAssignments,
              limit: 20
            });

            await this.bot.sendMessage(chatId, message);
          } catch (error) {
            console.error('❌ Error generating monthly report:', error);
            await this.bot.sendMessage(chatId, `❌ خطا در تهیه گزارش ماهانه: ${error.message}`);
          }
          return;
        }
        if (data === 'report_monthly_personnel') {
          console.log('🔘 Report: monthly personnel');
          await this.bot.answerCallbackQuery(query.id);
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ این دستور فقط برای مدیران است.');
            return;
          }

          // دریافت لیست کارمندان
          const allPersonnel = (await Personnel.getAll()).filter(p => p.isActive && p.role === 'staff');
          
          if (allPersonnel.length === 0) {
            await this.bot.sendMessage(chatId, '❌ هیچ کارمندی یافت نشد.');
            return;
          }

          // ایجاد لیست کشویی (Inline Keyboard)
          const keyboard = {
            inline_keyboard: []
          };

          // تقسیم کارمندان به ردیف‌های 2 تایی
          for (let i = 0; i < allPersonnel.length; i += 2) {
            const row = [];
            row.push({
              text: allPersonnel[i].name,
              callback_data: `report_monthly_personnel_${allPersonnel[i].id}`
            });
            if (i + 1 < allPersonnel.length) {
              row.push({
                text: allPersonnel[i + 1].name,
                callback_data: `report_monthly_personnel_${allPersonnel[i + 1].id}`
              });
            }
            keyboard.inline_keyboard.push(row);
          }

          keyboard.inline_keyboard.push([
            { text: '🔙 بازگشت', callback_data: 'menu_report' }
          ]);

          await this.bot.sendMessage(chatId, 
            '📆 گزارش ماهانه کارمند\n\n' +
            'لطفاً کارمند مورد نظر را انتخاب کنید:',
            { reply_markup: keyboard }
          );
          return;
        }
        if (data === 'menu_complete_center') {
          console.log('🔘 Menu button: complete_center');
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          // پیدا کردن مراکزی که اطلاعات کامل ندارند
          const allCenters = await Center.getAll();
          const incompleteCenters = allCenters.filter(c => !c.address || !c.city);

          if (incompleteCenters.length === 0) {
            await this.bot.sendMessage(chatId, '✅ همه مراکز اطلاعات کامل دارند!');
            return;
          }

          // شروع conversation
          this.conversations.set(chatId, {
            step: 'complete_center_selection',
            personnelId: personnel.id,
            data: {}
          });

          // نمایش لیست مراکز ناقص با pagination
          await this.handleCompleteCenterStart(chatId);
          return;
        }

        if (data === 'menu_province_contact') {
          await this.bot.answerCallbackQuery(query.id);
          console.log('🔘 Menu button: province_contact');
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          // شروع conversation برای تماس استان‌ها
          this.conversations.set(chatId, {
            step: 'province_center_selection',
            personnelId: personnel.id,
            data: {
              searchQuery: '',
              contactType: 'province'
            }
          });

          // نمایش لیست مراکز استان‌ها (غیرتهرانی)
          await this.showProvinceCentersList(chatId, 0, '');
          return;
        }

        if (data === 'menu_tehran_contact') {
          await this.bot.answerCallbackQuery(query.id);
          console.log('🔘 Menu button: tehran_contact');
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          // شروع conversation برای تماس تهران
          this.conversations.set(chatId, {
            step: 'province_center_selection',
            personnelId: personnel.id,
            data: {
              searchQuery: '',
              contactType: 'tehran'
            }
          });

          // نمایش لیست مراکز تهران
          await this.showTehranCentersList(chatId, 0, '');
          return;
        }

        if (data === 'menu_manage_centers') {
          await this.bot.answerCallbackQuery(query.id);
          console.log('🔘 Menu button: manage_centers');
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند مراکز را مدیریت کنند.');
            return;
          }

          // ایجاد conversation برای manage_centers
          this.conversations.set(chatId, {
            step: 'manage_centers',
            personnelId: personnel.id,
            data: {}
          });

          await this.showManageCentersMenu(chatId, 0);
          return;
        }
        if (data === 'menu_pending') {
          console.log('🔘 Menu button: pending');
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند این دستور را استفاده کنند.');
            return;
          }

          const pendingAssignments = await AssignmentModel.getAll({ status: 'pending' });
          
          if (pendingAssignments.length === 0) {
            await this.bot.sendMessage(chatId, '✅ هیچ ماموریتی در انتظار تایید نیست.');
            return;
          }

          // نمایش هر ماموریت با دکمه‌های تایید/رد
          for (const assignment of pendingAssignments.slice(0, 10)) {
            const assignmentPersonnel = await Personnel.getById(assignment.personnelId);
            const center = await Center.getById(assignment.centerId);
            const personnelName = (assignmentPersonnel?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
            const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');

            let message = `⏳ ماموریت در انتظار تایید\n\n`;
            message += `📋 کد ماموریت: #${assignment.id}\n`;
            message += `👤 پرسنل: ${personnelName}\n`;
            message += `🏢 مرکز: ${centerName}\n`;
            
            // اضافه کردن یادداشت‌های مرکز اگر وجود داشته باشد
            if (assignment.notes) {
              const notes = (assignment.notes || '').replace(/[*_`\[\]()]/g, '');
              message += `📝 یادداشت: ${notes}\n`;
            }
            
            if (assignment.totalCost) {
              message += `💰 هزینه کل: ${assignment.totalCost.toLocaleString('fa-IR')} تومان\n`;
            }

            const keyboard = {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ تایید', callback_data: `approve_${assignment.id}` },
                    { text: '❌ رد', callback_data: `reject_${assignment.id}` }
                  ],
                  [
                    { text: '📋 جزئیات', callback_data: `status_${assignment.id}` }
                  ]
                ]
              }
            };

            await this.bot.sendMessage(chatId, message, keyboard);
          }

          if (pendingAssignments.length > 10) {
            await this.bot.sendMessage(chatId, `\nو ${pendingAssignments.length - 10} ماموریت دیگر در انتظار تایید است.`);
          }
          return;
        }

        if (data === 'menu_help') {
          console.log('🔘 Menu button: help');
          const personnel = await Personnel.getByTelegramId(telegramId);
          const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');

          let helpMessage = `📖 راهنمای دستورات\n\n`;
          helpMessage += `دستورات عمومی:\n`;
          helpMessage += `/start - شروع کار با ربات و نمایش منو\n`;
          helpMessage += `/missions - لیست ماموریت‌های من\n`;
          helpMessage += `/newmission - ایجاد ماموریت جدید (step-by-step)\n`;
          helpMessage += `/status_<id> - نمایش جزئیات ماموریت\n`;
          helpMessage += `/report - گزارش‌های شخصی\n`;
          helpMessage += `/complete_center - تکمیل اطلاعات مرکز\n`;
          helpMessage += `/help - نمایش این راهنما\n\n`;

          if (isManager) {
            helpMessage += `دستورات مدیران:\n`;
            helpMessage += `/add - افزودن مرکز جدید\n`;
            helpMessage += `/pending - لیست ماموریت‌های در انتظار تایید\n`;
            helpMessage += `/approve_<id> - تایید ماموریت\n\n`;
          }

          helpMessage += `💡 نکته: برای استفاده از دستورات با ID، عدد را جایگزین <id> کنید.\n`;
          helpMessage += `مثال: /status_1 برای مشاهده ماموریت شماره 1`;

          await this.bot.sendMessage(chatId, helpMessage);
          return;
        }

        // Handle approve/reject with confirmation
        // IMPORTANT: approve_confirm_ and approve_cancel_ must be checked BEFORE approve_
        // because approve_confirm_ starts with approve_
        if (data.startsWith('approve_confirm_')) {
          const assignmentIdStr = data.replace('approve_confirm_', '');
          const assignmentId = parseInt(assignmentIdStr);
          console.log(`[Callback] approve_confirm_${assignmentIdStr} -> assignmentId: ${assignmentId} (type: ${typeof assignmentId})`);
          
          if (isNaN(assignmentId) || assignmentId <= 0) {
            console.error(`[Callback] Invalid assignmentId: ${assignmentIdStr}`);
            await this.bot.answerCallbackQuery(query.id, { text: '❌ شناسه ماموریت نامعتبر است' });
            return;
          }
          
          const loadingMsgId = await this.showLoadingMessage(chatId, '⏳ در حال تایید ماموریت...');
          try {
            await this.bot.answerCallbackQuery(query.id);
            console.log(`[Callback] Calling handleApprove for assignment #${assignmentId}`);
            await this.handleApprove(chatId, assignmentId, query.from.id.toString());
            await this.deleteLoadingMessage(chatId, loadingMsgId);
          } catch (error) {
            console.error(`[Callback] Error in handleApprove for assignment #${assignmentId}:`, error);
            await this.deleteLoadingMessage(chatId, loadingMsgId);
            await this.bot.sendMessage(chatId, `❌ خطا در تایید ماموریت: ${error.message}`);
          }
          return;
        }

        if (data.startsWith('approve_cancel_')) {
          await this.bot.answerCallbackQuery(query.id, { text: '❌ تایید لغو شد' });
          return;
        }

        // IMPORTANT: approve_with_comment_ must be checked BEFORE approve_
        // because approve_with_comment_ starts with approve_
        if (data.startsWith('approve_with_comment_')) {
          await this.bot.answerCallbackQuery(query.id);
          const assignmentIdStr = data.replace('approve_with_comment_', '');
          const assignmentId = parseInt(assignmentIdStr);
          console.log(`[Callback] approve_with_comment_ callback - data: ${data}, assignmentIdStr: ${assignmentIdStr}, assignmentId: ${assignmentId}`);
          
          if (isNaN(assignmentId) || assignmentId <= 0) {
            console.error(`[Callback] Invalid assignmentId: ${assignmentIdStr}`);
            await this.bot.sendMessage(chatId, `❌ شناسه ماموریت نامعتبر است: ${assignmentIdStr}`);
            return;
          }
          
          const assignment = await AssignmentModel.getById(assignmentId);
          console.log(`[Callback] AssignmentModel.getById(${assignmentId}) result:`, assignment ? `Found (ID: ${assignment.id})` : 'Not found');
          
          if (!assignment) {
            console.error(`[Callback] Assignment not found for ID: ${assignmentId}`);
            await this.bot.sendMessage(chatId, `❌ ماموریت یافت نشد. (ID: ${assignmentId})`);
            return;
          }

          // شروع conversation برای دریافت یادداشت مدیر
          const conversation = {
            step: 'manager_approve_comment',
            assignmentId: assignmentId,
            personnelId: query.from.id.toString()
          };
          this.conversations.set(chatId, conversation);

          await this.bot.sendMessage(chatId,
            `📝 *ارسال یادداشت برای کارشناس*\n\n` +
            `لطفاً یادداشت خود را برای کارشناس وارد کنید:\n\n` +
            `یا برای تایید بدون یادداشت، از دکمه زیر استفاده کنید:`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '⏭️ تایید بدون یادداشت', callback_data: `approve_confirm_${assignmentId}` },
                  { text: '❌ لغو', callback_data: `approve_cancel_${assignmentId}` }
                ]]
              },
              parse_mode: 'Markdown'
            }
          );
          return;
        }

        // Handle approve_ callback (must be AFTER approve_with_comment_ and HR leave callbacks)
        // IMPORTANT: Check HR leave callbacks BEFORE general approve_ handler
        if (data.startsWith('hr_leave_mgr_') || data.startsWith('approve_leave_') || data.startsWith('reject_leave_') || data.startsWith('leave_')) {
          // This will be handled by handleHrCallback, skip here
          return;
        }
        
        if (data.startsWith('approve_')) {
          await this.bot.answerCallbackQuery(query.id);
          const assignmentIdStr = data.replace('approve_', '');
          const assignmentId = parseInt(assignmentIdStr);
          console.log(`[Callback] approve_ callback - data: ${data}, assignmentIdStr: ${assignmentIdStr}, assignmentId: ${assignmentId} (type: ${typeof assignmentId})`);
          
          if (isNaN(assignmentId) || assignmentId <= 0) {
            console.error(`[Callback] Invalid assignmentId: ${assignmentIdStr}`);
            await this.bot.sendMessage(chatId, `❌ شناسه ماموریت نامعتبر است: ${assignmentIdStr}`);
            return;
          }
          
          const assignment = await AssignmentModel.getById(assignmentId);
          console.log(`[Callback] AssignmentModel.getById(${assignmentId}) result:`, assignment ? `Found (ID: ${assignment.id}, status: ${assignment.status})` : 'Not found');
          
          if (!assignment) {
            console.error(`[Callback] Assignment not found for ID: ${assignmentId}`);
            await this.bot.sendMessage(chatId, `❌ ماموریت یافت نشد. (ID: ${assignmentId})`);
            return;
          }
          
          // نمایش confirmation با امکان ارسال یادداشت
          const center = await Center.getById(assignment.centerId);
          const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📝 تایید با یادداشت', callback_data: `approve_with_comment_${assignmentId}` },
                  { text: '✅ تایید بدون یادداشت', callback_data: `approve_confirm_${assignmentId}` }
                ],
                [
                  { text: '❌ لغو', callback_data: `approve_cancel_${assignmentId}` }
                ]
              ]
            }
          };
          
          let confirmMessage = `⚠️ *تایید ماموریت*\n\n` +
            `آیا می‌خواهید ماموریت #${assignmentId} را تایید کنید؟\n\n` +
            `📋 مرکز: ${centerName}\n`;
          
          // اضافه کردن یادداشت اگر وجود داشته باشد
          if (assignment.notes) {
            const notes = assignment.notes.replace(/[*_`\[\]()]/g, '');
            confirmMessage += `📝 یادداشت: ${notes}\n`;
          }
          
          confirmMessage += `📊 وضعیت فعلی: ${this.getStatusLabel(assignment.status)}\n\n` +
            `💡 می‌توانید قبل از تایید یک یادداشت برای کارشناس ارسال کنید.`;
          
          await this.bot.sendMessage(chatId, confirmMessage, { ...keyboard, parse_mode: 'Markdown' });
          return;
        }

        // IMPORTANT: reject_confirm_ and reject_cancel_ must be checked BEFORE reject_
        // because reject_confirm_ and reject_cancel_ start with reject_
        if (data.startsWith('reject_confirm_')) {
          const assignmentIdStr = data.replace('reject_confirm_', '');
          const assignmentId = parseInt(assignmentIdStr);
          console.log(`[Callback] reject_confirm_ callback - data: ${data}, assignmentIdStr: ${assignmentIdStr}, assignmentId: ${assignmentId}`);
          
          if (isNaN(assignmentId) || assignmentId <= 0) {
            console.error(`[Callback] Invalid assignmentId: ${assignmentIdStr}`);
            await this.bot.answerCallbackQuery(query.id, { text: '❌ شناسه ماموریت نامعتبر است' });
            return;
          }
          
          const loadingMsgId = await this.showLoadingMessage(chatId, '⏳ در حال رد ماموریت...');
          try {
            await this.bot.answerCallbackQuery(query.id);
            console.log(`[Callback] Calling handleReject for assignment #${assignmentId}`);
            await this.handleReject(chatId, assignmentId, query.from.id.toString());
            await this.deleteLoadingMessage(chatId, loadingMsgId);
          } catch (error) {
            console.error(`[Callback] Error in handleReject for assignment #${assignmentId}:`, error);
            await this.deleteLoadingMessage(chatId, loadingMsgId);
            await this.bot.sendMessage(chatId, `❌ خطا در رد ماموریت: ${error.message}`);
          }
          return;
        }

        if (data.startsWith('reject_cancel_')) {
          await this.bot.answerCallbackQuery(query.id, { text: '❌ رد لغو شد' });
          return;
        }

        // Handle reject_ callback (must be AFTER reject_confirm_ and reject_cancel_)
        // IMPORTANT: Skip if it's a leave-related callback
        if (data.startsWith('approve_leave_') || data.startsWith('reject_leave_') || 
            (data.startsWith('leave_') && data.includes('_manager'))) {
          // This is handled by handleHrCallback, skip here
          return;
        }
        
        if (data.startsWith('reject_')) {
          await this.bot.answerCallbackQuery(query.id);
          const assignmentIdStr = data.replace('reject_', '');
          const assignmentId = parseInt(assignmentIdStr);
          console.log(`[Callback] reject_ callback - data: ${data}, assignmentIdStr: ${assignmentIdStr}, assignmentId: ${assignmentId} (type: ${typeof assignmentId})`);
          
          if (isNaN(assignmentId) || assignmentId <= 0) {
            console.error(`[Callback] Invalid assignmentId: ${assignmentIdStr}`);
            await this.bot.sendMessage(chatId, `❌ شناسه ماموریت نامعتبر است: ${assignmentIdStr}`);
            return;
          }
          
          const assignment = await AssignmentModel.getById(assignmentId);
          console.log(`[Callback] AssignmentModel.getById(${assignmentId}) result:`, assignment ? `Found (ID: ${assignment.id}, status: ${assignment.status})` : 'Not found');
          
          if (!assignment) {
            console.error(`[Callback] Assignment not found for ID: ${assignmentId}`);
            await this.bot.sendMessage(chatId, `❌ ماموریت یافت نشد. (ID: ${assignmentId})`);
            return;
          }
          
          // نمایش confirmation
          const center = await Center.getById(assignment.centerId);
          const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ بله، رد کن', callback_data: `reject_confirm_${assignmentId}` },
                  { text: '❌ خیر، لغو', callback_data: `reject_cancel_${assignmentId}` }
                ]
              ]
            }
          };
          
          await this.bot.sendMessage(chatId, 
            `⚠️ *رد ماموریت*\n\n` +
            `آیا مطمئن هستید که می‌خواهید ماموریت #${assignmentId} را رد کنید؟\n\n` +
            `📋 مرکز: ${centerName}\n` +
            `📊 وضعیت فعلی: ${this.getStatusLabel(assignment.status)}\n\n` +
            `💡 این عمل غیر قابل بازگشت است.`,
            { ...keyboard, parse_mode: 'Markdown' }
          );
          return;
        }
        if (data.startsWith('reject_confirm_')) {
          const assignmentIdStr = data.replace('reject_confirm_', '');
          const assignmentId = parseInt(assignmentIdStr);
          console.log(`[Callback] reject_confirm_ callback - data: ${data}, assignmentIdStr: ${assignmentIdStr}, assignmentId: ${assignmentId}`);
          
          if (isNaN(assignmentId) || assignmentId <= 0) {
            console.error(`[Callback] Invalid assignmentId: ${assignmentIdStr}`);
            await this.bot.answerCallbackQuery(query.id, { text: '❌ شناسه ماموریت نامعتبر است' });
            return;
          }
          
          const loadingMsgId = await this.showLoadingMessage(chatId, '⏳ در حال رد ماموریت...');
          try {
            await this.bot.answerCallbackQuery(query.id);
            console.log(`[Callback] Calling handleReject for assignment #${assignmentId}`);
            await this.handleReject(chatId, assignmentId, query.from.id.toString());
            await this.deleteLoadingMessage(chatId, loadingMsgId);
          } catch (error) {
            console.error(`[Callback] Error in handleReject for assignment #${assignmentId}:`, error);
            await this.deleteLoadingMessage(chatId, loadingMsgId);
            await this.bot.sendMessage(chatId, `❌ خطا در رد ماموریت: ${error.message}`);
          }
          return;
        }

        if (data.startsWith('reject_cancel_')) {
          await this.bot.answerCallbackQuery(query.id, { text: '❌ رد لغو شد' });
          return;
        }

        // Handle status from callback
        if (data.startsWith('status_')) {
          await this.bot.answerCallbackQuery(query.id);
          console.log('🔘 Callback: status');
          const assignmentId = data.replace('status_', '');
          await this.handleStatusCommand(chatId, parseInt(assignmentId), telegramId);
          return;
        }

        // Handle edit assignment
        if (data.startsWith('edit_assignment_')) {
          console.log('🔘 Callback: edit_assignment');
          const assignmentId = parseInt(data.replace('edit_assignment_', ''));
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (parseInt(assignment.personnelId) !== parseInt(personnel.id) && !isManager) {
            await this.bot.sendMessage(chatId, '❌ شما دسترسی به ویرایش این ماموریت ندارید.');
            return;
          }

          // نمایش منوی ویرایش
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📝 ویرایش یادداشت', callback_data: `edit_notes_${assignmentId}` }],
                [{ text: '💰 ویرایش هزینه اسنپ', callback_data: `edit_snapcost_${assignmentId}` }],
                ...(isManager ? [
                  [{ text: '📊 تغییر وضعیت', callback_data: `edit_status_${assignmentId}` }],
                  [{ text: '💳 ویرایش پرداخت شخصی', callback_data: `edit_payment_${assignmentId}` }]
                ] : []),
                [{ text: '🔙 بازگشت', callback_data: `status_${assignmentId}` }]
              ]
            }
          };

          await this.bot.sendMessage(chatId, 
            `✏️ ویرایش ماموریت #${assignmentId}\n\n` +
            `لطفاً موردی را که می‌خواهید ویرایش کنید انتخاب کنید:`,
            keyboard
          );
          return;
        }

        // Handle delete assignment
        if (data.startsWith('delete_assignment_')) {
          console.log('🔘 Callback: delete_assignment');
          const assignmentId = parseInt(data.replace('delete_assignment_', ''));
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند ماموریت را حذف کنند.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          const center = await Center.getById(assignment.centerId);
          const assignmentPersonnel = await Personnel.getById(assignment.personnelId);
          const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          const personnelName = (assignmentPersonnel?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');

          // نمایش صفحه تایید حذف
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ بله، حذف کن', callback_data: `confirm_delete_assignment_${assignmentId}` },
                  { text: '❌ خیر، لغو', callback_data: `status_${assignmentId}` }
                ]
              ]
            }
          };

          await this.bot.sendMessage(chatId,
            `⚠️ تایید حذف ماموریت\n\n` +
            `📋 ماموریت #${assignmentId}\n` +
            `👤 پرسنل: ${personnelName}\n` +
            `🏢 مرکز: ${centerName}\n` +
            `📊 وضعیت: ${this.getStatusLabel(assignment.status)}\n\n` +
            `⚠️ آیا مطمئن هستید که می‌خواهید این ماموریت را حذف کنید؟\n\n` +
            `این عمل غیر قابل بازگشت است!`,
            keyboard
          );
          return;
        }
        // Handle confirm delete assignment with loading
        if (data.startsWith('confirm_delete_assignment_')) {
          await this.bot.answerCallbackQuery(query.id);
          console.log('🔘 Callback: confirm_delete_assignment');
          const assignmentId = parseInt(data.replace('confirm_delete_assignment_', ''));
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند ماموریت را حذف کنند.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          const loadingMsgId = await this.showLoadingMessage(chatId, '⏳ در حال حذف ماموریت...');
          try {
            // حذف ماموریت
            const deleted = await AssignmentModel.delete(assignmentId);
            await this.deleteLoadingMessage(chatId, loadingMsgId);
            
            if (deleted) {
              await this.bot.sendMessage(chatId,
                `✅ *ماموریت حذف شد*\n\n` +
                `📋 ماموریت #${assignmentId}\n` +
                `👤 پرسنل: ${Personnel.getById(assignment.personnelId)?.name || 'نامشخص'}\n` +
                `🏢 مرکز: ${(await Center.getById(assignment.centerId))?.name || 'نامشخص'}\n\n` +
                `💡 ماموریت با موفقیت از سیستم حذف شد.`,
                { parse_mode: 'Markdown' }
              );
            } else {
              await this.bot.sendMessage(chatId, '❌ خطا در حذف ماموریت.');
            }
          } catch (error) {
            await this.deleteLoadingMessage(chatId, loadingMsgId);
            console.error('Error deleting assignment:', error);
            await this.bot.sendMessage(chatId, `❌ خطا در حذف ماموریت: ${error.message}`);
          }
          return;
        }

        // Handle edit assignment actions
        if (data.startsWith('edit_notes_')) {
          const assignmentId = parseInt(data.replace('edit_notes_', ''));
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (parseInt(assignment.personnelId) !== parseInt(personnel.id) && !isManager) {
            await this.bot.sendMessage(chatId, '❌ شما دسترسی به ویرایش این ماموریت ندارید.');
            return;
          }

          this.conversations.set(chatId, {
            step: 'edit_notes',
            assignmentId: assignmentId,
            personnelId: personnel.id
          });

          await this.bot.sendMessage(chatId, 
            `✏️ ویرایش یادداشت ماموریت #${assignmentId}\n\n` +
            `یادداشت فعلی: ${assignment.notes || '(خالی)'}\n\n` +
            `لطفاً یادداشت جدید را وارد کنید:`
          );
          return;
        }

        if (data.startsWith('edit_snapcost_')) {
          const assignmentId = parseInt(data.replace('edit_snapcost_', ''));
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (parseInt(assignment.personnelId) !== parseInt(personnel.id) && !isManager) {
            await this.bot.sendMessage(chatId, '❌ شما دسترسی به ویرایش این ماموریت ندارید.');
            return;
          }

          this.conversations.set(chatId, {
            step: 'edit_snapcost',
            assignmentId: assignmentId,
            personnelId: personnel.id
          });

          await this.bot.sendMessage(chatId, 
            `✏️ ویرایش هزینه اسنپ ماموریت #${assignmentId}\n\n` +
            `هزینه فعلی: ${assignment.snapCost ? assignment.snapCost.toLocaleString('fa-IR') + ' تومان' : '(ثبت نشده)'}\n\n` +
            `لطفاً هزینه جدید را وارد کنید (عدد):`
          );
          return;
        }

        if (data.startsWith('edit_status_')) {
          const assignmentId = parseInt(data.replace('edit_status_', ''));
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند وضعیت را تغییر دهند.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏳ در انتظار', callback_data: `set_status_${assignmentId}_pending` }],
                [{ text: '✅ تایید شده', callback_data: `set_status_${assignmentId}_approved` }],
                [{ text: '🔄 در حال انجام', callback_data: `set_status_${assignmentId}_in-progress` }],
                [{ text: '✔️ تکمیل شده', callback_data: `set_status_${assignmentId}_completed` }],
                [{ text: '❌ رد شده', callback_data: `set_status_${assignmentId}_rejected` }],
                [{ text: '🚫 لغو شده', callback_data: `set_status_${assignmentId}_cancelled` }]
              ]
            }
          };

          await this.bot.sendMessage(chatId, 
            `✏️ تغییر وضعیت ماموریت #${assignmentId}\n\n` +
            `وضعیت فعلی: ${this.getStatusLabel(assignment.status)}\n\n` +
            `لطفاً وضعیت جدید را انتخاب کنید:`,
            keyboard
          );
          return;
        }
        if (data.startsWith('edit_payment_')) {
          const assignmentId = parseInt(data.replace('edit_payment_', ''));
          const personnel = await Personnel.getByTelegramId(telegramId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند پرداخت شخصی را تغییر دهند.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          this.conversations.set(chatId, {
            step: 'edit_payment',
            assignmentId: assignmentId,
            personnelId: personnel.id
          });

          await this.bot.sendMessage(chatId, 
            `✏️ ویرایش پرداخت شخصی ماموریت #${assignmentId}\n\n` +
            `پرداخت فعلی: ${assignment.personalPayment ? assignment.personalPayment.toLocaleString('fa-IR') + ' تومان' : '0 تومان'}\n\n` +
            `لطفاً مبلغ جدید را وارد کنید (عدد):`
          );
          return;
        }
        if (data.startsWith('set_status_')) {
          const parts = data.split('_');
          const assignmentId = parseInt(parts[2]);
          const newStatus = parts[3];
          const personnel = await Personnel.getByTelegramId(telegramId);
          
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const isManager = personnel.role === 'admin' || personnel.role === 'manager';
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند وضعیت را تغییر دهند.');
            return;
          }

          const assignment = await AssignmentModel.getById(assignmentId);
          if (!assignment) {
            await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
            return;
          }

          const validStatuses = ['pending', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled'];
          if (!validStatuses.includes(newStatus)) {
            await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
            return;
          }

          const updateData = { status: newStatus };
          if (newStatus === 'approved' && assignment.status !== 'approved') {
            updateData.approvedAt = new Date().toISOString();
            updateData.managerId = parseInt(personnel.id);
          }
          if (newStatus === 'completed' && assignment.status !== 'completed') {
            updateData.completedAt = new Date().toISOString();
          }

          await AssignmentModel.update(assignmentId, updateData);
          await this.bot.sendMessage(chatId, 
            `✅ وضعیت ماموریت #${assignmentId} به "${this.getStatusLabel(newStatus)}" تغییر کرد.`
          );
          
          // نمایش مجدد جزئیات
          await this.handleStatusCommand(chatId, assignmentId, telegramId);
          return;
        }

        // Handle add snap cost to incomplete assignment
        if (data.startsWith('add_snapcost_')) {
          const assignmentId = data.replace('add_snapcost_', '');
          await this.handleAddSnapCost(chatId, assignmentId, query.from?.id?.toString());
          return;
        }

        // این callback دیگر استفاده نمی‌شود - کاربر باید ابتدا هزینه‌ها را تکمیل کند
        // if (data === 'skip_incomplete_snapcost') {
        //   await this.handleSkipSnapCost(chatId);
        //   return;
        // }


        // Handle skip snap cost in newmission
        if (data === 'skip_snapcost') {
          console.log('🔘 Callback: skip_snapcost');
          await this.handleSkipSnapCost(chatId);
          return;
        }

        // Handle skip snap cost in add_snapcost (for incomplete assignments)
        if (data === 'skip_add_snapcost') {
          console.log('🔘 Callback: skip_add_snapcost');
          const conversation = this.conversations.get(chatId);
          if (conversation && conversation.step === 'add_snapcost') {
            this.conversations.delete(chatId);
            await this.bot.sendMessage(chatId, 
              `✅ هزینه اسنپ رد شد.\n\n` +
              `💡 می‌توانید بعداً با استفاده از /status_${conversation.assignmentId} هزینه اسنپ را اضافه کنید.`
            );
          }
          return;
        }

        // Handle center list pagination
        if (data.startsWith('center_list_page_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (conversation && conversation.personnelId) {
            const personnel = await Personnel.getById(conversation.personnelId);
            const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
            const parts = data.replace('center_list_page_', '').split('_');
            const page = parseInt(parts[0]);
            const searchQuery = parts.slice(1).join('_') || '';
            const typeFilter = conversation?.data?.typeFilter || null;
            const responsibleFilter = conversation?.data?.responsibleFilter || null;
            await this.showCentersList(chatId, page, searchQuery, typeFilter, responsibleFilter, isManager);
          } else {
            await this.showCentersList(chatId, 0, '', null, null, false);
          }
          return;
        }

        // Handle toggle center selection
        if (data.startsWith('toggle_center_')) {
          await this.bot.answerCallbackQuery(query.id);
          const centerId = data.replace('toggle_center_', '');
          await this.handleToggleCenter(chatId, centerId, query.id);
          return;
        }

        // Handle confirm centers selection with confirmation
        if (data === 'confirm_centers') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
            return;
          }
          const selectedCenters = conversation.data.selectedCenters || [];
          if (selectedCenters.length === 0) {
            await this.bot.sendMessage(chatId, '❌ لطفاً حداقل یک مرکز انتخاب کنید.');
            return;
          }
          
          // نمایش confirmation
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ بله، ادامه', callback_data: 'confirm_centers_yes' },
                  { text: '❌ خیر، برگشت', callback_data: 'confirm_centers_no' }
                ]
              ]
            }
          };
          
          await this.bot.sendMessage(chatId, 
            `⚠️ *تایید انتخاب مراکز*\n\n` +
            `آیا مطمئن هستید که می‌خواهید با ${selectedCenters.length} مرکز انتخاب شده ادامه دهید؟\n\n` +
            `💡 بعد از این، باید برای هر مرکز یادداشت وارد کنید.`,
            { ...keyboard, parse_mode: 'Markdown' }
          );
          return;
        }

        // Handle confirm_centers_yes
        if (data === 'confirm_centers_yes') {
          await this.bot.answerCallbackQuery(query.id);
          await this.handleConfirmCenters(chatId);
          return;
        }

        // Handle confirm_centers_no
        if (data === 'confirm_centers_no') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (conversation) {
            const personnel = Personnel.getById(conversation.personnelId);
            const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
            const typeFilter = conversation.data?.typeFilter || null;
            const responsibleFilter = conversation.data?.responsibleFilter || null;
            await this.showCentersList(chatId, 0, '', typeFilter, responsibleFilter, isManager);
          }
          return;
        }
        // Handle back to main menu / company
        if (data === 'menu_back_to_main') {
          await this.bot.answerCallbackQuery(query.id);
          // حذف conversation برای بازگشت به منو
          this.conversations.delete(chatId);
          
          const personnel = Personnel.getByTelegramId(query.from.id.toString());
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
            return;
          }

          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📋 ماموریت‌های من', callback_data: 'menu_missions' },
                  { text: '➕ ماموریت جدید', callback_data: 'menu_newmission' }
                ],
                [
                  { text: '👥 منابع انسانی', callback_data: 'menu_hr' },
                  { text: '🏥 تاییدیه‌ها', callback_data: 'menu_medical' }
                ],
                [
                  { text: '📊 گزارش شخصی', callback_data: 'menu_report' },
                  { text: '📝 تکمیل اطلاعات مرکز', callback_data: 'menu_complete_center' }
                ],
                ...(personnel.role === 'admin' || personnel.role === 'manager' ? [[
                  { text: '⏳ در انتظار تایید', callback_data: 'menu_pending' },
                  { text: '⚙️ مدیریت مراکز', callback_data: 'menu_manage_centers' }
                ]] : []),
                [
                  { text: '❓ راهنما', callback_data: 'menu_help' }
                ]
              ]
            }
          };

          const personnelName = (personnel.name || 'کاربر').replace(/[*_`\[\]()]/g, '');
          const welcomeMessage = `👋 منوی اصلی\n\nسلام ${personnelName}!`;

          await this.bot.sendMessage(chatId, welcomeMessage, keyboard);
          return;
        }

        // Handle province centers pagination
        if (data.startsWith('province_centers_page_')) {
          await this.bot.answerCallbackQuery(query.id);
          const page = parseInt(data.replace('province_centers_page_', ''));
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }
          const searchQuery = conversation.data?.searchQuery || '';
          const contactType = conversation.data?.contactType || 'province';
          if (contactType === 'tehran') {
            await this.showTehranCentersList(chatId, page, searchQuery);
          } else {
            await this.showProvinceCentersList(chatId, page, searchQuery);
          }
          return;
        }

        // Handle province city filter menu
        if (data === 'province_filter_city_menu') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }
          if (conversation.data?.contactType === 'tehran') {
            await this.bot.sendMessage(chatId, '❌ فیلتر استان فقط برای مراکز استان‌ها قابل استفاده است.');
            return;
          }
          await this.showProvinceCityFilterMenu(chatId, 0);
          return;
        }

        if (data.startsWith('province_filter_city_idx_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }
          if (conversation.data?.contactType === 'tehran') {
            await this.bot.sendMessage(chatId, '❌ فیلتر استان فقط برای مراکز استان‌ها قابل استفاده است.');
            return;
          }

          // بررسی اینکه آیا از index استفاده شده یا نام مستقیم
          if (data.startsWith('province_filter_city_idx_')) {
            const index = parseInt(data.replace('province_filter_city_idx_', ''));
            const cityFilterMap = conversation.data?.cityFilterMap || {};
            const cityName = cityFilterMap[index];

            if (!cityName) {
              await this.bot.sendMessage(chatId, '❌ خطا: استان یافت نشد. لطفاً دوباره تلاش کنید.');
              return;
            }
            // اعمال فیلتر استان
            conversation.data.cityFilter = cityName;
            conversation.step = 'province_center_selection';
            this.conversations.set(chatId, conversation);
            await this.showProvinceCentersList(chatId, 0, conversation.data?.searchQuery || '');
            return;
          }

          // روش قدیمی برای backward compatibility
          const cityName = decodeURIComponent(data.replace('province_filter_city_', ''));

          if (cityName === 'clear') {
            // حذف فیلتر
            conversation.data.cityFilter = null;
            conversation.step = 'province_center_selection';
            this.conversations.set(chatId, conversation);
            await this.showProvinceCentersList(chatId, 0, conversation.data?.searchQuery || '');
            return;
          }

          // اعمال فیلتر استان
          conversation.data.cityFilter = cityName;
          conversation.step = 'province_center_selection';
          this.conversations.set(chatId, conversation);
          await this.showProvinceCentersList(chatId, 0, conversation.data?.searchQuery || '');
          return;
        }

        // Handle province city filter pagination
        if (data.startsWith('province_city_filter_page_')) {
          await this.bot.answerCallbackQuery(query.id);
          const page = parseInt(data.replace('province_city_filter_page_', ''));
          await this.showProvinceCityFilterMenu(chatId, page);
          return;
        }

        // Handle back to province centers list
        if (data === 'province_back_to_list') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" یا "تماس‌های تهران" شروع کنید.');
            return;
          }
          conversation.step = 'province_center_selection';
          this.conversations.set(chatId, conversation);
          const contactType = conversation.data?.contactType || 'province';
          if (contactType === 'tehran') {
            await this.showTehranCentersList(chatId, 0, conversation.data?.searchQuery || '');
          } else {
            await this.showProvinceCentersList(chatId, 0, conversation.data?.searchQuery || '');
          }
          return;
        }

        if (data === 'tehran_filter_expert_menu') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.data?.contactType !== 'tehran') {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های تهران" شروع کنید.');
            return;
          }
          await this.showTehranExpertFilterMenu(chatId, 0);
          return;
        }

        if (data.startsWith('tehran_filter_expert_page_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.data?.contactType !== 'tehran') {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های تهران" شروع کنید.');
            return;
          }
          const page = parseInt(data.replace('tehran_filter_expert_page_', ''));
          await this.showTehranExpertFilterMenu(chatId, page);
          return;
        }

        if (data === 'tehran_filter_expert_clear') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.data?.contactType !== 'tehran') {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های تهران" شروع کنید.');
            return;
          }
          conversation.data.tehranExpertFilter = null;
          this.conversations.set(chatId, conversation);
          await this.showTehranCentersList(chatId, 0, conversation.data?.searchQuery || '');
          return;
        }

        if (data.startsWith('tehran_filter_expert_idx_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.data?.contactType !== 'tehran') {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های تهران" شروع کنید.');
            return;
          }
          const index = data.replace('tehran_filter_expert_idx_', '');
          const expertMap = conversation.data?.tehranExpertMap || {};
          const expertInfo = expertMap[index];

          if (!expertInfo) {
            await this.bot.sendMessage(chatId, '❌ گزینه انتخابی معتبر نیست. لطفاً دوباره تلاش کنید.');
            return;
          }

          conversation.data.tehranExpertFilter = {
            id: expertInfo.id,
            name: expertInfo.name
          };
          this.conversations.set(chatId, conversation);
          await this.showTehranCentersList(chatId, 0, conversation.data?.searchQuery || '');
          return;
        }

        // Handle province center selection
        if (data.startsWith('province_select_center_')) {
          await this.bot.answerCallbackQuery(query.id);
          const centerId = parseInt(data.replace('province_select_center_', ''));
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'province_center_selection') {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }

          const center = await Center.getById(centerId);
          if (!center) {
            await this.bot.sendMessage(chatId, '❌ مرکز یافت نشد.');
            return;
          }

          // ذخیره مرکز انتخاب شده و شروع فرآیند ثبت تماس
          conversation.data.selectedCenterId = centerId;
          conversation.step = 'province_contact_note';
          this.conversations.set(chatId, conversation);

          const centerName = (center.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          const city = (center.city || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏭️ رد کردن یادداشت', callback_data: 'province_contact_note_skip' }],
                [{ text: '❌ لغو', callback_data: 'province_contact_cancel' }]
              ]
            }
          };
          
          await this.bot.sendMessage(chatId,
            `📞 *ثبت تماس با مرکز*\n\n` +
            `🏢 مرکز: ${centerName}\n` +
            `📍 شهر: ${city}\n\n` +
            `📝 لطفاً یادداشت تماس را وارد کنید (اختیاری):\n\n` +
            `💡 می‌توانید از دکمه "رد کردن یادداشت" استفاده کنید.`,
            { ...keyboard, parse_mode: 'Markdown' }
          );
          return;
        }
        // Handle province contact note skip
        if (data === 'province_contact_note_skip') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'province_contact_note') {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }

          conversation.data.contactNote = null;
          conversation.step = 'province_change_status';
          this.conversations.set(chatId, conversation);

          const center = Center.getById(conversation.data.selectedCenterId);
          const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          
          // خواندن برچسب‌ها از مرکز
          let centerTags = [];
          if (center && center.tags) {
            if (Array.isArray(center.tags)) {
              centerTags = center.tags;
            } else if (typeof center.tags === 'string') {
              try {
                centerTags = JSON.parse(center.tags);
                if (!Array.isArray(centerTags)) {
                  centerTags = [];
                }
              } catch (e) {
                centerTags = [];
              }
            }
          }
          
          // اگر برچسبی نداشت، از type استفاده کن
          const currentStatus = centerTags.length > 0 ? centerTags[0] : (center?.type || 'lead');
          
          const typeLabels = {
            'lead': 'سرنخ',
            'opportunity': 'فرصت',
            'customer': 'مشتری',
            'old_customer': 'مشتری قدیمی'
          };

          const timelineText = await this.getCenterStatusTimelineText(center?.id);
          
          let message = `📞 *ثبت تماس*\n\n` +
            `🏢 مرکز: ${centerName}\n` +
            `📝 یادداشت: (بدون یادداشت)\n\n` +
            `📊 وضعیت فعلی: ${typeLabels[currentStatus] || currentStatus}`;

          if (timelineText) {
            message += `\n${timelineText}`;
          }

          message += `\n\nلطفاً وضعیت جدید مرکز را انتخاب کنید:`;
          
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔵 سرنخ', callback_data: 'province_status_lead' },
                  { text: '🟢 فرصت', callback_data: 'province_status_opportunity' }
                ],
                [
                  { text: '🟡 مشتری', callback_data: 'province_status_customer' },
                  { text: '🟠 مشتری قدیمی', callback_data: 'province_status_old_customer' }
                ],
                [
                  { text: '⏭️ بدون تغییر', callback_data: 'province_status_skip' }
                ]
              ]
            }
          };

          await this.bot.sendMessage(chatId,
            message,
            { ...keyboard, parse_mode: 'Markdown' }
          );
          return;
        }

        // Handle province contact cancel
        if (data === 'province_contact_cancel') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (conversation) {
            this.conversations.delete(chatId);
          }
          await this.bot.sendMessage(chatId, '❌ ثبت تماس لغو شد.');
          return;
        }
        // Handle province search
        if (data === 'province_search_centers') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }
          conversation.step = 'province_center_search';
          this.conversations.set(chatId, conversation);
          const contactType = conversation.data?.contactType || 'province';
          const promptMessage = contactType === 'tehran'
            ? `🔍 *جستجو در مراکز تهران*\n\n` +
              `لطفاً یکی از موارد زیر را وارد کنید:\n` +
              `• نام مرکز\n` +
              `• نام کارشناس/مسئول\n\n` +
              `💡 برای لغو، "لغو" بفرستید.`
            : `🔍 *جستجو در مراکز استان‌ها*\n\n` +
              `لطفاً یکی از موارد زیر را وارد کنید:\n` +
              `• نام مرکز\n` +
              `• نام استان/شهر\n` +
              `• نام کارشناس/مسئول\n\n` +
              `💡 برای لغو، "لغو" بفرستید.`;
          await this.bot.sendMessage(chatId, 
            promptMessage,
            { parse_mode: 'Markdown' }
          );
          return;
        }
        // Handle province status change
        if (data.startsWith('province_status_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'province_change_status') {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }

          const statusType = data.replace('province_status_', '');
          const centerId = conversation.data.selectedCenterId;
          const center = await Center.getById(centerId);
          
          if (!center) {
            await this.bot.sendMessage(chatId, '❌ مرکز یافت نشد.');
            this.conversations.delete(chatId);
            return;
          }

          // اگر skip نبود، وضعیت را تغییر بده
          let updatedCenter = center;
          if (statusType !== 'skip') {
            // به‌روزرسانی هم type و هم tags
            await Center.update(centerId, { type: statusType, tags: [statusType] });
            updatedCenter = await Center.getById(centerId) || center;
          }

          // نمایش منوی برچسب (اختیاری)
          conversation.step = 'province_add_tags';
          this.conversations.set(chatId, conversation);

          const centerName = (updatedCenter.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          
          // اطمینان از اینکه tags به درستی parse شده است
          let currentTags = [];
          if (updatedCenter.tags) {
            if (Array.isArray(updatedCenter.tags)) {
              currentTags = updatedCenter.tags;
            } else if (typeof updatedCenter.tags === 'string') {
              try {
                currentTags = JSON.parse(updatedCenter.tags);
                if (!Array.isArray(currentTags)) {
                  currentTags = [];
                }
              } catch (e) {
                currentTags = [];
              }
            }
          }
          
          const availableTags = ['lead', 'opportunity', 'customer', 'old_customer'];
          
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                ...availableTags.map(tag => [{
                  text: `${currentTags.includes(tag) ? '✅' : '⚪'} ${tag === 'lead' ? 'سرنخ' : tag === 'opportunity' ? 'فرصت' : tag === 'customer' ? 'مشتری' : 'قدیمی'}`,
                  callback_data: `province_toggle_tag_${tag}`
                }]),
                [
                  { text: '✅ ثبت تماس', callback_data: 'province_save_contact' },
                  { text: '⏭️ بدون برچسب', callback_data: 'province_save_contact' }
                ]
              ]
            }
          };

          // تبدیل برچسب‌های انگلیسی به فارسی برای نمایش
          const tagLabels = {
            'lead': 'سرنخ',
            'opportunity': 'فرصت',
            'customer': 'مشتری',
            'old_customer': 'قدیمی'
          };
          const displayTags = currentTags.length > 0 
            ? currentTags.map(tag => tagLabels[tag] || tag).join(', ')
            : 'بدون برچسب';
          const timelineText = await this.getCenterStatusTimelineText(updatedCenter?.id);
          
          let message = `📞 *ثبت تماس*\n\n` +
            `🏢 مرکز: ${centerName}\n` +
            `📝 یادداشت: ${conversation.data.contactNote || '(بدون یادداشت)'}\n` +
            `🏷️ برچسب: ${displayTags}`;

          if (timelineText) {
            message += `\n${timelineText}`;
          }
          message += `\n\n🏷️ برچسب‌های فعلی: ${displayTags}\n\n` +
            `لطفاً برچسب‌ها را انتخاب کنید (اختیاری):`;
          
          await this.bot.sendMessage(chatId,
            message,
            { ...keyboard, parse_mode: 'Markdown' }
          );
          return;
        }
        // Handle province tag toggle
        if (data.startsWith('province_toggle_tag_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'province_add_tags') {
            return;
          }

          const tag = data.replace('province_toggle_tag_', '');
          const centerId = conversation.data.selectedCenterId;
          const center = await Center.getById(centerId);
          
          if (!center) {
            return;
          }

          // اطمینان از اینکه tags به درستی parse شده است
          let currentTags = [];
          if (center.tags) {
            if (Array.isArray(center.tags)) {
              currentTags = center.tags;
            } else if (typeof center.tags === 'string') {
              try {
                currentTags = JSON.parse(center.tags);
                if (!Array.isArray(currentTags)) {
                  currentTags = [];
                }
              } catch (e) {
                currentTags = [];
              }
            }
          }

          // اجازه فقط یک برچسب
          if (currentTags.includes(tag)) {
            currentTags = [];
          } else {
            currentTags = [tag];
          }

          // به‌روزرسانی مرکز و دریافت داده جدید
          await Center.update(centerId, { tags: currentTags, type: currentTags.length > 0 ? currentTags[0] : center.type }); // به‌روزرسانی هم tags و هم type
          const updatedCenter = await Center.getById(centerId);
          
          // اطمینان از اینکه tags به درستی parse شده است
          let updatedTags = [];
          if (updatedCenter && updatedCenter.tags) {
            if (Array.isArray(updatedCenter.tags)) {
              updatedTags = updatedCenter.tags;
            } else if (typeof updatedCenter.tags === 'string') {
              try {
                updatedTags = JSON.parse(updatedCenter.tags);
                if (!Array.isArray(updatedTags)) {
                  updatedTags = [];
                }
              } catch (e) {
                updatedTags = [];
              }
            }
          }

          // نمایش مجدد منوی برچسب
          const centerName = (center.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          const availableTags = ['lead', 'opportunity', 'customer', 'old_customer'];
          
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                ...availableTags.map(t => [{
                  text: `${updatedTags.includes(t) ? '✅' : '⚪'} ${t === 'lead' ? 'سرنخ' : t === 'opportunity' ? 'فرصت' : t === 'customer' ? 'مشتری' : 'قدیمی'}`,
                  callback_data: `province_toggle_tag_${t}`
                }]),
                [
                  { text: '✅ ثبت تماس', callback_data: 'province_save_contact' },
                  { text: '⏭️ بدون برچسب', callback_data: 'province_save_contact' }
                ]
              ]
            }
          };

          // تبدیل برچسب‌های انگلیسی به فارسی برای نمایش
          const tagLabels = {
            'lead': 'سرنخ',
            'opportunity': 'فرصت',
            'customer': 'مشتری',
            'old_customer': 'قدیمی'
          };
          const timelineText = await this.getCenterStatusTimelineText(updatedCenter?.id || centerId);
          const displayTags = updatedTags.length > 0 
            ? updatedTags.map(t => tagLabels[t] || t).join(', ')
            : 'بدون برچسب';
          
          let message = `📞 *ثبت تماس*\n\n` +
            `🏢 مرکز: ${centerName}\n` +
            `📝 یادداشت: ${conversation.data.contactNote || '(بدون یادداشت)'}\n` +
            `🏷️ برچسب: ${displayTags}`;

          if (timelineText) {
            message += `\n${timelineText}`;
          }

          message += `\n\n🏷️ برچسب‌های فعلی: ${displayTags}\n\n` +
            `لطفاً برچسب‌ها را انتخاب کنید (اختیاری):`;
          
          await this.bot.editMessageText(
            message,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              ...keyboard,
              parse_mode: 'Markdown'
            }
          );
          return;
        }

        // Handle province save contact
        if (data === 'province_save_contact') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
            return;
          }

          const centerId = conversation.data.selectedCenterId;
          const center = await Center.getById(centerId);
          const personnel = await Personnel.getById(conversation.personnelId);
          
          if (!center || !personnel) {
            await this.bot.sendMessage(chatId, '❌ خطا در ثبت تماس.');
            this.conversations.delete(chatId);
            return;
          }

          // دریافت برچسب‌های فعلی مرکز
          const updatedCenter = await Center.getById(centerId);
          let centerTags = [];
          if (updatedCenter && updatedCenter.tags) {
            if (Array.isArray(updatedCenter.tags)) {
              centerTags = updatedCenter.tags;
            } else if (typeof updatedCenter.tags === 'string') {
              try {
                centerTags = JSON.parse(updatedCenter.tags);
                if (!Array.isArray(centerTags)) {
                  centerTags = [];
                }
              } catch (e) {
                centerTags = [];
              }
            }
          }

          // ایجاد contact
          const contactType = conversation.data?.contactType || 'province';
          const contact = await Contact.create({
            personnelId: parseInt(personnel.id),
            centerId: parseInt(centerId),
            contactType: contactType,
            notes: conversation.data.contactNote || null,
            tags: centerTags.length > 0 ? centerTags : null
          });

          const centerName = (center.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          
          const timelineText = await this.getCenterStatusTimelineText(updatedCenter?.id || centerId);
          
          // تبدیل برچسب‌های انگلیسی به فارسی برای نمایش
          const tagLabels = {
            'lead': 'سرنخ',
            'opportunity': 'فرصت',
            'customer': 'مشتری',
            'old_customer': 'قدیمی'
          };
          const displayTags = centerTags.length > 0 
            ? centerTags.map(tag => tagLabels[tag] || tag).join(', ')
            : (updatedCenter?.type ? (updatedCenter.type === 'lead' ? 'سرنخ' : updatedCenter.type === 'opportunity' ? 'فرصت' : updatedCenter.type === 'customer' ? 'مشتری' : 'قدیمی') : 'بدون برچسب');
          let message = `✅ *تماس ثبت شد*\n\n`;
          
          if (contact && contact.id) {
            message += `📋 کد تماس: #${contact.id}\n`;
          }
          
          message += `🏢 مرکز: ${centerName}\n` +
            `📝 یادداشت: ${conversation.data.contactNote || '(بدون یادداشت)'}\n` +
            `🏷️ برچسب: ${displayTags}`;

          if (timelineText) {
            message += `\n${timelineText}`;
          }
          message += `\n\n💡 تماس با موفقیت ثبت شد.`;
          
          await this.bot.sendMessage(chatId,
            message,
            { parse_mode: 'Markdown' }
          );

          this.conversations.delete(chatId);
          return;
        }

        if (data === 'search_centers') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
            return;
          }
          conversation.step = 'center_search';
          this.conversations.set(chatId, conversation);
          await this.bot.sendMessage(chatId, 
            `🔍 *جستجو در مراکز*\n\n` +
            `لطفاً نام مرکز، آدرس یا شهر را وارد کنید:\n\n` +
            `💡 می‌توانید از فیلترهای نوع (سرنخ، فرصت، مشتری، مشتری قدیمی) نیز استفاده کنید.`,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        if (data === 'show_all_centers') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          let isManager = false;
          if (conversation && conversation.personnelId) {
            const personnel = await Personnel.getById(conversation.personnelId);
            isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
          }
          const typeFilter = conversation?.data?.typeFilter || null;
          const responsibleFilter = conversation?.data?.responsibleFilter || null;
          await this.showCentersList(chatId, 0, '', typeFilter, responsibleFilter, isManager);
          return;
        }

        // Handle show all centers list (without buttons, just text)
        if (data === 'show_all_centers_list') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
            return;
          }
          
          conversation.data = conversation.data || {};
          conversation.data.showAll = true;
          this.conversations.set(chatId, conversation);
          
          const personnel = await Personnel.getById(conversation.personnelId);
          const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
          const typeFilter = conversation.data?.typeFilter || null;
          const responsibleFilter = conversation.data?.responsibleFilter || null;
          await this.showCentersList(chatId, 0, '', typeFilter, responsibleFilter, isManager);
          return;
        }

        // Handle show paginated centers
        if (data === 'show_paginated_centers') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
            return;
          }
          
          conversation.data = conversation.data || {};
          conversation.data.showAll = false;
          this.conversations.set(chatId, conversation);
          
          const personnel = await Personnel.getById(conversation.personnelId);
          const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
          const typeFilter = conversation.data?.typeFilter || null;
          const responsibleFilter = conversation.data?.responsibleFilter || null;
          await this.showCentersList(chatId, 0, '', typeFilter, responsibleFilter, isManager);
          return;
        }

        // Handle set page size
        if (data.startsWith('set_page_size_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
            return;
          }
          
          const pageSize = parseInt(data.replace('set_page_size_', ''));
          conversation.data = conversation.data || {};
          conversation.data.centersPerPage = pageSize;
          conversation.data.showAll = false;
          this.conversations.set(chatId, conversation);
          
          const personnel = await Personnel.getById(conversation.personnelId);
          const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
          const typeFilter = conversation.data?.typeFilter || null;
          const responsibleFilter = conversation.data?.responsibleFilter || null;
          await this.showCentersList(chatId, 0, '', typeFilter, responsibleFilter, isManager);
          return;
        }

        // Handle filter my centers (for employees)
        if (data === 'filter_my_centers') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
            return;
          }
          
          conversation.data = conversation.data || {};
          const currentShowOnlyMine = conversation.data.showOnlyMine || false;
          conversation.data.showOnlyMine = !currentShowOnlyMine;
          this.conversations.set(chatId, conversation);
          
          const personnel = await Personnel.getById(conversation.personnelId);
          const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
          const typeFilter = conversation.data?.typeFilter || null;
          const responsibleFilter = conversation.data?.responsibleFilter || null;
          await this.showCentersList(chatId, 0, '', typeFilter, responsibleFilter, isManager);
          return;
        }

        // Handle type filter
        if (data.startsWith('filter_type_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          
          // اگر conversation وجود ندارد، برای manage_centers یک conversation موقت ایجاد می‌کنیم
          if (!conversation) {
            // بررسی اینکه آیا این از manage_centers است
            const personnel = await Personnel.getByTelegramId(telegramId);
            if (!personnel) {
              await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
              return;
            }
            
            const isManager = personnel.role === 'admin' || personnel.role === 'manager';
            if (isManager) {
              // برای manage_centers، conversation موقت ایجاد می‌کنیم
              const tempConversation = {
                step: 'manage_centers',
                personnelId: personnel.id,
                data: {}
              };
              
              if (data === 'filter_type_clear') {
                tempConversation.data.typeFilter = null;
              } else {
                const type = data.replace('filter_type_', '');
                tempConversation.data.typeFilter = type;
              }
              
              this.conversations.set(chatId, tempConversation);
              
              // برای manage_centers باید از showManageCentersMenu استفاده کنیم
              // با فیلتر اعمال شده
              const filterType = data === 'filter_type_clear' ? null : data.replace('filter_type_', '');
              const responsibleFilter = tempConversation.data?.responsibleFilter || null;
              await this.showManageCentersMenu(chatId, 0, filterType, responsibleFilter);
              return;
            } else {
              await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
              return;
            }
          }
          
          let isManager = false;
          if (conversation.personnelId) {
            const personnel = Personnel.getById(conversation.personnelId);
            isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
          }
          
          if (data === 'filter_type_clear') {
            conversation.data.typeFilter = null;
          } else {
            const type = data.replace('filter_type_', '');
            conversation.data.typeFilter = type;
          }
          this.conversations.set(chatId, conversation);
          
          const responsibleFilter = conversation.data?.responsibleFilter || null;
          
          // اگر conversation از نوع manage_centers است، از showManageCentersMenu استفاده می‌کنیم
          if (conversation.step === 'manage_centers' || conversation.step === 'manage_centers_search') {
            await this.showManageCentersMenu(chatId, 0, conversation.data.typeFilter, responsibleFilter);
          } else {
            await this.showCentersList(chatId, 0, '', conversation.data.typeFilter, responsibleFilter, isManager);
          }
          return;
        }
        // Handle responsible filter (only for managers)
        if (data.startsWith('filter_responsible_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          
          // اگر conversation وجود ندارد، برای manage_centers یک conversation موقت ایجاد می‌کنیم
          if (!conversation) {
            const personnel = await Personnel.getByTelegramId(telegramId);
            if (!personnel) {
              await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
              return;
            }
            
            const isManager = personnel.role === 'admin' || personnel.role === 'manager';
            if (!isManager) {
              await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند بر اساس مسئول فیلتر کنند.');
              return;
            }
            
            const tempConversation = {
              step: 'manage_centers',
              personnelId: personnel.id,
              data: {}
            };
            
            if (data === 'filter_responsible_clear') {
              tempConversation.data.responsibleFilter = null;
            } else {
              const responsibleId = parseInt(data.replace('filter_responsible_', ''));
              tempConversation.data.responsibleFilter = responsibleId;
            }
            
            this.conversations.set(chatId, tempConversation);
            
            const typeFilter = tempConversation.data?.typeFilter || null;
            const responsibleFilter = tempConversation.data?.responsibleFilter || null;
            await this.showManageCentersMenu(chatId, 0, typeFilter, responsibleFilter);
            return;
          }
          
          let isManager = false;
          if (conversation.personnelId) {
            const personnel = Personnel.getById(conversation.personnelId);
            isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
          }
          
          if (!isManager) {
            await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند بر اساس مسئول فیلتر کنند.');
            return;
          }
          
          if (data === 'filter_responsible_clear') {
            conversation.data.responsibleFilter = null;
          } else {
            const responsibleId = parseInt(data.replace('filter_responsible_', ''));
            conversation.data.responsibleFilter = responsibleId;
          }
          
          this.conversations.set(chatId, conversation);
          
          const typeFilter = conversation.data?.typeFilter || null;
          const responsibleFilter = conversation.data?.responsibleFilter || null;
          
          // اگر conversation از نوع manage_centers است، از showManageCentersMenu استفاده می‌کنیم
          if (conversation.step === 'manage_centers' || conversation.step === 'manage_centers_search') {
            await this.showManageCentersMenu(chatId, 0, typeFilter, responsibleFilter);
          } else {
            await this.showCentersList(chatId, 0, '', typeFilter, responsibleFilter, isManager);
          }
          return;
        }

        // Handle complete center pagination (both old and new format for compatibility)
        if (data.startsWith('complete_center_page_')) {
          const page = parseInt(data.replace('complete_center_page_', ''));
          await this.handleCompleteCenterPagination(chatId, page);
          return;
        }
        if (data.startsWith('cc_p_')) {
          const page = parseInt(data.replace('cc_p_', ''));
          await this.handleCompleteCenterPagination(chatId, page);
          return;
        }

        // Handle complete center search (short form)
        if (data === 'complete_center_search' || data === 'cc_search') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /complete_center شروع کنید.');
            return;
          }
          conversation.step = 'complete_center_search';
          this.conversations.set(chatId, conversation);
          await this.bot.sendMessage(chatId, 
            '🔍 جستجوی مراکز\n\n' +
            'لطفاً نام مرکز، آدرس یا شهر را وارد کنید:'
          );
          return;
        }

        // Handle complete center show all (short form)
        if (data === 'complete_center_show_all' || data === 'cc_show_all') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /complete_center شروع کنید.');
            return;
          }
          conversation.data = conversation.data || {};
          conversation.data.showAll = true;
          this.conversations.set(chatId, conversation);
          await this.handleCompleteCenterStart(chatId);
          return;
        }

        // Handle complete center show incomplete (short form)
        if (data === 'complete_center_show_incomplete' || data === 'cc_show_inc') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            await this.bot.sendMessage(chatId, '❌ لطفاً از /complete_center شروع کنید.');
            return;
          }
          conversation.data = conversation.data || {};
          conversation.data.showAll = false;
          this.conversations.set(chatId, conversation);
          await this.handleCompleteCenterStart(chatId);
          return;
        }

        // Handle complete center selection (both old and new format for compatibility)
        if (data.startsWith('complete_center_')) {
          const centerId = data.replace('complete_center_', '');
          await this.handleCompleteCenterStart(chatId, centerId);
          return;
        }
        if (data.startsWith('cc_')) {
          const centerId = data.replace('cc_', '');
          await this.handleCompleteCenterStart(chatId, centerId);
          return;
        }

        // Handle add center type selection
        if (data.startsWith('add_center_type_')) {
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'add_center_type') {
            await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر.');
            return;
          }
          
          const type = data.replace('add_center_type_', '');
          conversation.data.type = type;
          conversation.step = 'add_center_address';
          this.conversations.set(chatId, conversation);
          
          await this.bot.sendMessage(chatId,
            `✅ نوع مرکز ثبت شد\n\n` +
            `مرحله 3️⃣: آدرس\n\n` +
            `لطفاً آدرس مرکز را وارد کنید:`
          );
          return;
        }
        // Handle add center skip district
        if (data === 'add_center_skip_district') {
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'add_center_district') {
            await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر.');
            return;
          }
          
          conversation.data.district = null;
          conversation.step = 'add_center_responsible';
          this.conversations.set(chatId, conversation);
          
          // نمایش لیست پرسنل برای انتخاب مسئول
          const allPersonnel = await Personnel.getAll();
          const personnelButtons = allPersonnel.slice(0, 10).map(p => [
            { text: p.name, callback_data: `add_center_responsible_${p.id}` }
          ]);
          personnelButtons.push([
            { text: '⏭️ بدون مسئول', callback_data: 'add_center_skip_responsible' }
          ]);

          await this.bot.sendMessage(chatId,
            `✅ منطقه رد شد\n\n` +
            `مرحله 6️⃣: مسئول مرکز (اختیاری)\n\n` +
            `لطفاً مسئول مرکز را انتخاب کنید:`,
            {
              reply_markup: {
                inline_keyboard: personnelButtons
              }
            }
          );
          return;
        }
        // Handle add center responsible selection
        if (data.startsWith('add_center_responsible_')) {
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'add_center_responsible') {
            await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر.');
            return;
          }
          
          const personnelId = parseInt(data.replace('add_center_responsible_', ''));
          const personnel = await Personnel.getById(personnelId);
          if (!personnel) {
            await this.bot.sendMessage(chatId, '❌ پرسنل یافت نشد.');
            return;
          }
          
          conversation.data.responsiblePersonnelId = personnelId;
          await this.finishAddCenter(chatId, conversation);
          return;
        }

        // Handle add center skip responsible
        if (data === 'add_center_skip_responsible') {
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'add_center_responsible') {
            await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر.');
            return;
          }
          
          conversation.data.responsiblePersonnelId = null;
          await this.finishAddCenter(chatId, conversation);
          return;
        }

        // Handle manage centers pagination
        if (data.startsWith('manage_centers_page_')) {
          await this.bot.answerCallbackQuery(query.id);
          const page = parseInt(data.replace('manage_centers_page_', ''));
          const conversation = this.conversations.get(chatId);
          const typeFilter = conversation?.data?.typeFilter || null;
          const responsibleFilter = conversation?.data?.responsibleFilter || null;
          const searchQuery = conversation?.data?.searchQuery || '';
          const cityFilter = conversation?.data?.cityFilter || null;
          await this.showManageCentersMenu(chatId, page, typeFilter, responsibleFilter, searchQuery, cityFilter);
          return;
        }
        // Handle filter city
        if (data.startsWith('filter_city_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            const personnel = await Personnel.getByTelegramId(telegramId);
            if (!personnel) {
              await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
              return;
            }
            const isManager = personnel.role === 'admin' || personnel.role === 'manager';
            if (!isManager) {
              await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند مراکز را مدیریت کنند.');
              return;
            }
            const tempConversation = {
              step: 'manage_centers',
              personnelId: personnel.id,
              data: {}
            };
            this.conversations.set(chatId, tempConversation);
            conversation = tempConversation;
          }
          
          conversation.data = conversation.data || {};
          if (data === 'filter_city_clear') {
            conversation.data.cityFilter = null;
          } else {
            const city = data.replace('filter_city_', '');
            conversation.data.cityFilter = city;
          }
          this.conversations.set(chatId, conversation);
          
          const typeFilter = conversation.data?.typeFilter || null;
          const responsibleFilter = conversation.data?.responsibleFilter || null;
          const searchQuery = conversation.data?.searchQuery || '';
          const cityFilter = conversation.data?.cityFilter || null;
          await this.showManageCentersMenu(chatId, 0, typeFilter, responsibleFilter, searchQuery, cityFilter);
          return;
        }
        // Handle manage centers stats
        if (data === 'manage_centers_stats') {
          await this.bot.answerCallbackQuery(query.id);
          const allCenters = await Center.getAll({ isActive: true });
          const allAssignments = await AssignmentModel.getAll({});
          
          const stats = {
            total: allCenters.length,
            byType: {
              lead: allCenters.filter(c => c.type === 'lead').length,
              opportunity: allCenters.filter(c => c.type === 'opportunity').length,
              customer: allCenters.filter(c => c.type === 'customer').length,
              old_customer: allCenters.filter(c => c.type === 'old_customer').length
            },
            incomplete: allCenters.filter(c => !c.address || !c.city).length,
            withoutResponsible: allCenters.filter(c => !c.responsiblePersonnelId).length,
            withAssignments: allCenters.filter(c => {
              const centerAssignments = allAssignments.filter(a => parseInt(a.centerId) === parseInt(c.id));
              return centerAssignments.length > 0;
            }).length,
            totalAssignments: allAssignments.length
          };
          
          // محاسبه آمار بر اساس شهر
          const cities = Array.from(new Set(allCenters.map(c => c.city).filter(Boolean)));
          const cityStats = cities.map(city => {
            const cityCenters = allCenters.filter(c => c.city === city);
            const cityAssignments = allAssignments.filter(a => {
              const center = allCenters.find(c => parseInt(c.id) === parseInt(a.centerId));
              return center && center.city === city;
            });
            return {
              city,
              centers: cityCenters.length,
              assignments: cityAssignments.length
            };
          }).sort((a, b) => b.centers - a.centers);
          
          let message = `📊 *آمار کامل مراکز*\n\n`;
          message += `*📋 آمار کلی:*\n`;
          message += `   • کل مراکز: ${stats.total}\n`;
          message += `   • 🔵 سرنخ: ${stats.byType.lead}\n`;
          message += `   • 🟡 فرصت: ${stats.byType.opportunity}\n`;
          message += `   • 🟢 مشتری: ${stats.byType.customer}\n`;
          message += `   • 🔵 قدیمی: ${stats.byType.old_customer}\n`;
          message += `   • ⚠️ ناقص اطلاعات: ${stats.incomplete}\n`;
          message += `   • 👤 بدون مسئول: ${stats.withoutResponsible}\n`;
          message += `   • 📋 با ماموریت: ${stats.withAssignments}\n\n`;
          
          message += `*📊 آمار ماموریت‌ها:*\n`;
          message += `   • کل ماموریت‌ها: ${stats.totalAssignments}\n`;
          message += `   • میانگین ماموریت/مرکز: ${(stats.totalAssignments / Math.max(stats.total, 1)).toFixed(1)}\n\n`;
          
          if (cityStats.length > 0) {
            message += `*🏙️ آمار بر اساس شهر:*\n`;
            cityStats.slice(0, 10).forEach((stat, index) => {
              message += `   ${index + 1}. ${stat.city}: ${stat.centers} مرکز، ${stat.assignments} ماموریت\n`;
            });
            if (cityStats.length > 10) {
              message += `   ... و ${cityStats.length - 10} شهر دیگر\n`;
            }
          }
          
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 بازگشت', callback_data: 'manage_centers_back' }]
              ]
            }
          };
          
          await this.bot.sendMessage(chatId, message, { 
            ...keyboard,
            parse_mode: 'Markdown'
          });
          return;
        }
        // Handle manage center details
        if (data.startsWith('manage_center_')) {
          const centerId = parseInt(data.replace('manage_center_', ''));
          await this.showCenterManageDetails(chatId, centerId);
          return;
        }
        // Handle manage centers search
        if (data === 'manage_centers_search') {
          const conversation = this.conversations.get(chatId);
          if (!conversation) {
            // ایجاد conversation موقت
            const personnel = await Personnel.getByTelegramId(telegramId);
            if (!personnel) {
              await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
              return;
            }
            
            const isManager = personnel.role === 'admin' || personnel.role === 'manager';
            if (!isManager) {
              await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند مراکز را مدیریت کنند.');
              return;
            }
            
            const tempConversation = {
              step: 'manage_centers_search',
              personnelId: personnel.id,
              data: {}
            };
            this.conversations.set(chatId, tempConversation);
            await this.bot.sendMessage(chatId, 
              `🔍 جستجو در مراکز\n\n` +
              `لطفاً نام مرکز، آدرس یا شهر را وارد کنید:`
            );
            return;
          }
          
          conversation.step = 'manage_centers_search';
          this.conversations.set(chatId, conversation);
          await this.bot.sendMessage(chatId, 
            `🔍 جستجو در مراکز\n\n` +
            `لطفاً نام مرکز، آدرس یا شهر را وارد کنید:`
          );
          return;
        }
        // Handle manage centers back
        if (data === 'manage_centers_back') {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          const typeFilter = conversation?.data?.typeFilter || null;
          const responsibleFilter = conversation?.data?.responsibleFilter || null;
          const searchQuery = conversation?.data?.searchQuery || '';
          const cityFilter = conversation?.data?.cityFilter || null;
          await this.showManageCentersMenu(chatId, 0, typeFilter, responsibleFilter, searchQuery, cityFilter);
          return;
        }
        // Handle change type center button
        if (data.startsWith('change_type_center_')) {
          const centerId = parseInt(data.replace('change_type_center_', ''));
          await this.showChangeTypeMenu(chatId, centerId);
          return;
        }

        // Handle change type to specific type
        if (data.startsWith('change_type_to_')) {
          const parts = data.replace('change_type_to_', '').split('_');
          const type = parts[0]; // lead, opportunity, customer, old_customer
          const centerId = parseInt(parts[1]);

          const center = await Center.getById(centerId);
          if (!center) {
            await this.bot.sendMessage(chatId, '❌ مرکز یافت نشد.');
            return;
          }

          const typeLabels = {
            'lead': '⚪ سرنخ',
            'opportunity': '🟡 فرصت',
            'customer': '🟢 مشتری',
            'old_customer': '🔵 مشتری قدیمی'
          };

          await Center.update(centerId, { type });
          const updatedCenter = await Center.getById(centerId);
          const centerName = (updatedCenter.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');

          await this.bot.sendMessage(chatId,
            `✅ نوع مرکز تغییر یافت!\n\n` +
            `🏢 مرکز: ${centerName}\n` +
            `🏷️ نوع جدید: ${typeLabels[type] || '⚪ سرنخ'}`
          );

          // بازگشت به جزئیات مرکز
          await this.showCenterManageDetails(chatId, centerId);
          return;
        }

        // Handle assign center button
        if (data.startsWith('assign_center_center_')) {
          const centerId = parseInt(data.replace('assign_center_center_', ''));
          await this.showAssignCenterMenu(chatId, centerId);
          return;
        }

        // Handle assign center to personnel
        if (data.startsWith('assign_center_to_')) {
          const parts = data.replace('assign_center_to_', '').split('_');
          const personnelId = parseInt(parts[0]);
          const centerId = parseInt(parts[1]);

          const center = await Center.getById(centerId);
          const personnel = await Personnel.getById(personnelId);
          
          if (!center || !personnel) {
            await this.bot.sendMessage(chatId, '❌ مرکز یا پرسنل یافت نشد.');
            return;
          }

          await Center.update(centerId, { responsiblePersonnelId: personnelId });
          const updatedCenter = await Center.getById(centerId);
          const centerName = (updatedCenter.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          const personnelName = personnel.name.replace(/[*_`\[\]()]/g, '');

          await this.bot.sendMessage(chatId,
            `✅ مرکز به کارمند اختصاص داده شد!\n\n` +
            `🏢 مرکز: ${centerName}\n` +
            `👤 مسئول جدید: ${personnelName}`
          );

          // بازگشت به جزئیات مرکز
          await this.showCenterManageDetails(chatId, centerId);
          return;
        }

        // Handle remove center responsible
        if (data.startsWith('assign_center_remove_')) {
          const centerId = parseInt(data.replace('assign_center_remove_', ''));

          const center = await Center.getById(centerId);
          if (!center) {
            await this.bot.sendMessage(chatId, '❌ مرکز یافت نشد.');
            return;
          }

          await Center.update(centerId, { responsiblePersonnelId: null });
          const updatedCenter = await Center.getById(centerId);
          const centerName = (updatedCenter.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');

          await this.bot.sendMessage(chatId,
            `✅ مسئول مرکز حذف شد!\n\n` +
            `🏢 مرکز: ${centerName}\n` +
            `👤 مسئول: بدون مسئول`
          );

          // بازگشت به جزئیات مرکز
          await this.showCenterManageDetails(chatId, centerId);
          return;
        }

        // Handle cancel mission
        if (data === 'cancel_mission') {
          this.conversations.delete(chatId);
          await this.bot.sendMessage(chatId, '❌ ایجاد ماموریت لغو شد.');
          return;
        }

        // Handle select discount code from list
        if (data.startsWith('select_discount_')) {
          await this.bot.answerCallbackQuery(query.id);
          const conversation = this.conversations.get(chatId);
          if (conversation && conversation.step === 'discountcode') {
            // اطمینان از وجود conversation.data
            if (!conversation.data) {
              conversation.data = {};
            }

            const discountId = parseInt(data.replace('select_discount_', ''));
            const discount = await DiscountCode.getById(discountId);
            
            if (!discount || !discount.isActive) {
              await this.bot.sendMessage(chatId, '❌ کد تخفیف یافت نشد یا غیرفعال است.');
              return;
            }

            // بررسی اعتبار تاریخ
            const now = new Date();
            if (discount.validFrom) {
              const validFrom = new Date(discount.validFrom);
              if (now < validFrom) {
                await this.bot.sendMessage(chatId, '❌ این کد تخفیف هنوز اعتبار ندارد.');
                return;
              }
            }
            if (discount.validUntil) {
              const validUntil = new Date(discount.validUntil);
              if (now > validUntil) {
                await this.bot.sendMessage(chatId, '❌ این کد تخفیف منقضی شده است.');
                return;
              }
            }
            
            // بررسی تعداد استفاده
            if (discount.maxUses && discount.currentUses >= discount.maxUses) {
              await this.bot.sendMessage(chatId, '❌ تعداد استفاده از این کد تخفیف به پایان رسیده است.');
              return;
            }

            // ذخیره کد تخفیف
            conversation.data.discountCode = discount.code;
            conversation.data.discountCodeId = discount.id;
            conversation.step = 'notes';
            this.conversations.set(chatId, conversation);

            let discountInfo = '';
            if (discount.discountType === 'percentage') {
              discountInfo = `${discount.discountValue}%`;
            } else {
              discountInfo = `${discount.discountValue.toLocaleString('fa-IR')} تومان`;
            }

            if (conversation.data?.skipFinalNotes) {
              await this.finishMission(chatId, conversation);
            } else {
              await this.bot.sendMessage(chatId,
                `➕ ایجاد ماموریت جدید\n\n` +
                `✅ مرحله 3️⃣ تکمیل شد: کد تخفیف "${discount.code}" (${discountInfo})\n\n` +
                `مرحله 4️⃣: یادداشت (اختیاری)\n\n` +
                `لطفاً یادداشت یا توضیحات را وارد کنید یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`,
                {
                  reply_markup: {
                    inline_keyboard: [[
                      { text: '⏭️ رد کردن', callback_data: 'skip_notes' },
                      { text: '✅ ثبت نهایی', callback_data: 'finish_mission' }
                    ]]
                  }
                }
              );
            }
          }
          return;
        }

        // Handle skip discount code
        if (data === 'skip_discountcode') {
          const conversation = this.conversations.get(chatId);
          if (conversation && conversation.step === 'discountcode') {
            // اطمینان از وجود conversation.data
            if (!conversation.data) {
              conversation.data = {};
            }

            conversation.data.discountCode = null;
            conversation.data.discountCodeId = null;
            conversation.step = 'notes';
            this.conversations.set(chatId, conversation);
          if (conversation.data?.skipFinalNotes) {
            await this.finishMission(chatId, conversation);
          } else {
            await this.bot.sendMessage(chatId,
              `➕ ایجاد ماموریت جدید\n\n` +
              `✅ مرحله 3️⃣ رد شد\n\n` +
              `مرحله 4️⃣: یادداشت (اختیاری)\n\n` +
              `لطفاً یادداشت یا توضیحات را وارد کنید یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`,
              {
                reply_markup: {
                  inline_keyboard: [[
                    { text: '⏭️ رد کردن', callback_data: 'skip_notes' },
                    { text: '✅ ثبت نهایی', callback_data: 'finish_mission' }
                  ]]
                }
              }
            );
          }
          }
          return;
        }
        // Handle skip notes
        if (data === 'skip_notes') {
          const conversation = this.conversations.get(chatId);
          if (conversation && conversation.step === 'notes') {
            // اطمینان از وجود conversation.data
            if (!conversation.data) {
              conversation.data = {};
            }

            conversation.data.notes = null;
            await this.finishMission(chatId, conversation);
          }
          return;
        }
        // Handle finish mission
        if (data === 'finish_mission') {
          const conversation = this.conversations.get(chatId);
          if (conversation) {
            // اطمینان از وجود conversation.data
            if (!conversation.data) {
              conversation.data = {};
            }

            await this.finishMission(chatId, conversation);
          }
          return;
        }

        // Handle skip district in complete center
        if (data === 'skip_district') {
          const conversation = this.conversations.get(chatId);
          if (!conversation || conversation.step !== 'center_district') {
            await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر.');
            return;
          }

          conversation.data.district = null;
          conversation.step = 'center_finish';
          this.conversations.set(chatId, conversation);

          const center = Center.getById(conversation.centerId);
          const updateData = {
            address: conversation.data.address,
            city: conversation.data.city,
            district: null
          };

          await Center.update(conversation.centerId, updateData);
          this.conversations.delete(chatId);

          const centerName = (center.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          let message = `✅ اطلاعات مرکز تکمیل شد!\n\n`;
          message += `🏢 مرکز: ${centerName}\n`;
          message += `📍 آدرس: ${updateData.address}\n`;
          message += `🏙️ شهر: ${updateData.city}\n`;

          await this.bot.sendMessage(chatId, message);
          return;
        }

      } catch (error) {
        console.error('❌ Error in callback query handler:', error);
        await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      }
    });

    // ========== Message Handler (برای conversation) - باید در آخر باشد ==========
    console.log('📝 Registering message handler...');
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const telegramId = msg.from?.id?.toString() || 'Unknown';
      const text = msg.text || '';
      const hasFile = !!(msg.document || msg.photo);
      const isVoiceMessage = !!(msg.voice || msg.audio);
      
      console.log(`📨 RAW MESSAGE RECEIVED from ${telegramId}: ${text.substring(0, 50) || (hasFile ? 'FILE' : 'NO TEXT')}`);
      
      const conversation = this.conversations.get(chatId);

      // Skip commands (آنها توسط onText مدیریت می‌شوند) مگر اینکه در جریان مکالمه باشیم
      if (text && text.startsWith('/') && !conversation) {
        console.log(`⏭️ Skipping command (handled by onText): ${text}`);
        return;
      }

      if (!conversation) {
        if (isVoiceMessage) {
          await this.handleAiVoiceCommand(msg);
          return;
        }
        if (text && !text.startsWith('/')) {
          await this.handleAiTextCommand(msg);
          return;
        }
        // Log unhandled messages
        console.log(`📨 Unhandled message from ${telegramId}: ${text.substring(0, 50) || (hasFile ? 'FILE' : 'NO TEXT')}`);
        return;
      }

      if (conversation?.type === 'ai_followup') {
        console.log(`[AI Followup] Handling follow-up response for chat ${chatId}`);
        if (!text) {
          await this.bot.sendMessage(chatId, '❌ لطفاً پاسخ خود را به صورت متن ارسال کنید.');
          return;
        }
        await this.handleAiFollowupMessage(msg, conversation, text);
        return;
      }

      if (conversation?.type === 'ai_center_search') {
        await this.handleAiCenterSearchText(msg, conversation);
        return;
      }

      if (conversation?.type === 'ai_center_selection') {
        await this.handleAiCenterManualInput(msg, conversation);
        return;
      }

      if (conversation?.type === 'ai_contact_region') {
        await this.handleAiContactRegionText(msg, conversation);
        return;
      }

      if (conversation && text && this.isLikelyAiIntentText(text)) {
        console.log(`[AI Interrupt] Exiting conversation (${conversation.type || conversation.step}) due to new AI intent text.`);
        this.conversations.delete(chatId);
        await this.handleAiTextCommand(msg);
        return;
      }

      // Handle conversation messages (including files)
      console.log(`💬 Handling conversation message for step: ${conversation.step}, hasFile: ${hasFile}, hasText: ${!!text}`);
      await this.handleConversationMessage(msg, conversation);
    });

    console.log('✅ Commands setup completed');
    console.log('📊 Total registered handlers:');
    console.log(`   - onText handlers: 13`);
    console.log(`   - callback_query handler: 1`);
    console.log(`   - message handler: 1`);
    console.log('🎯 Bot is ready to receive commands!');
  }

  // Helper: چک کردن کامل بودن اطلاعات مرکز
  isCenterComplete(center) {
    return !!(center.name && center.address && center.city);
  }

  // Helper: گرفتن یا ساخت مرکز شرکت
  async getOrCreateCompanyCenter() {
    const companyName = 'شرکت آتنا زیست درمان';
    const centers = await Center.getAll({ isActive: true });
    let center = centers.find(c => c.name === companyName);

    if (!center) {
      center = await Center.create({
        name: companyName,
        address: 'تهران، دفتر مرکزی آتنا زیست درمان',
        city: 'تهران',
        district: null,
        type: 'customer',
        responsiblePersonnelId: null,
        latitude: null,
        longitude: null,
        snapLocationId: null
      });
      console.log(`🏢 Company center created with ID ${center.id}`);
    }

    return center;
  }

  async createCompanyReturnMission(chatId, personnel, companyCenter) {
    try {
      // اطمینان از پاک بودن وضعیت قبلی مکالمه
      this.conversations.delete(chatId);

      const assignment = await AssignmentModel.create({
        personnelId: parseInt(personnel.id),
        centerId: parseInt(companyCenter.id),
        snapCost: 0,
        discountCode: null,
        discountCodeId: null,
        notes: 'بازگشت به شرکت',
        centerNotes: null,
        personalPayment: 0
      });

      let message = `✅ ماموریت بازگشت به شرکت ثبت شد!\n\n`;
      message += `📋 ماموریت #${assignment.id}\n`;
      message += `🏢 مرکز: ${companyCenter.name}\n`;
      message += `👤 ثبت کننده: ${personnel.name}\n`;
      message += `💰 هزینه اسنپ: ۰ تومان\n`;
      message += `💡 برای ماموریت جدید می‌توانید از دکمه‌های زیر استفاده کنید.`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ ماموریت جدید', callback_data: 'menu_newmission' },
              { text: '📋 ماموریت‌های من', callback_data: 'menu_missions' }
            ],
            [
              { text: '🏠 بازگشت به منو', callback_data: 'menu_back_to_main' }
            ]
          ]
        }
      };

      await this.bot.sendMessage(chatId, message, keyboard);
    } catch (error) {
      console.error('Error in createCompanyReturnMission:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در ثبت ماموریت بازگشت به شرکت: ${error.message}`);
    }
  }

  // Helper: toggle انتخاب مرکز
  async handleToggleCenter(chatId, centerId, queryId) {
    try {
      const conversation = this.conversations.get(chatId);
      if (!conversation || conversation.step !== 'center_selection') {
        await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
        return;
      }

      const selectedCenters = conversation.data.selectedCenters || [];
      const centerIdNum = parseInt(centerId);

      if (selectedCenters.includes(centerIdNum)) {
        // حذف از لیست
        conversation.data.selectedCenters = selectedCenters.filter(id => id !== centerIdNum);
      } else {
        // اضافه به لیست
        conversation.data.selectedCenters = [...selectedCenters, centerIdNum];
      }

      this.conversations.set(chatId, conversation);

      // نمایش مجدد لیست با حفظ فیلترها و صفحه فعلی
      const personnel = await Personnel.getById(conversation.personnelId);
      const isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
      const typeFilter = conversation.data?.typeFilter || null;
      const responsibleFilter = conversation.data?.responsibleFilter || null;
      const searchQuery = conversation.data?.searchQuery || '';
      const currentPage = conversation.data?.currentCenterPage || 0;
      await this.showCentersList(chatId, currentPage, searchQuery, typeFilter, responsibleFilter, isManager);
    } catch (error) {
      console.error('Error in handleToggleCenter:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // Helper: تایید انتخاب مراکز و ایجاد ماموریت‌ها
  async handleConfirmCenters(chatId) {
    try {
      const conversation = this.conversations.get(chatId);
      if (!conversation || conversation.step !== 'center_selection') {
        await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
        return;
      }

      const selectedCenters = conversation.data.selectedCenters || [];
      if (selectedCenters.length === 0) {
        await this.bot.sendMessage(chatId, '❌ لطفاً حداقل یک مرکز انتخاب کنید.');
        return;
      }

      // ذخیره مراکز انتخاب شده و رفتن مستقیم به snapcost (حذف مرحله center_notes)
      conversation.data.selectedCenters = selectedCenters;
      conversation.step = 'snapcost';
      this.conversations.set(chatId, conversation);

      // رفتن مستقیم به مرحله snapcost
      let message = `✅ ${selectedCenters.length} مرکز انتخاب شد\n\n`;
      message += `مرحله 2️⃣: هزینه اسنپ (اختیاری)\n\n`;
      message += `لطفاً هزینه اسنپ را به تومان وارد کنید:\n\n`;
      message += `یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [[
            { text: '⏭️ رد کردن', callback_data: 'skip_snapcost' }
          ]]
        }
      };
      
      await this.bot.sendMessage(chatId, message, keyboard);
    } catch (error) {
      console.error('Error in handleConfirmCenters:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // ===== منابع انسانی و تاییدیه پزشکی =====
  async handleHrCallback(query) {
    const data = query.data || '';
    const isHrAction = data === 'menu_hr' ||
      data.startsWith('hr_') ||
      data === 'menu_medical' ||
      data.startsWith('medical_') ||
      data.startsWith('datepick|') ||
      (data.startsWith('leave_') && data.includes('_manager')) ||
      data.startsWith('approve_leave_') ||
      data.startsWith('reject_leave_');

    if (!isHrAction) {
      return false;
    }

    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();

    try {
        if (data === 'menu_hr') {
        await this.showHrMenu(chatId, telegramId);
        return true;
      }
        
        // Handle old format: leave_<id>_manager<X>
        // This format doesn't specify approve/reject, so we need to check the button text
        if (data.startsWith('leave_') && data.includes('_manager')) {
          const parts = data.split('_'); // leave <id> manager<X>
          if (parts.length >= 3) {
            const leaveId = parseInt(parts[1], 10);
            if (!Number.isFinite(leaveId) || leaveId <= 0) {
              await this.bot.sendMessage(chatId, '❌ شناسه درخواست نامعتبر است.');
              return true;
            }
            // Try to determine action from button text
            // Check if the callback query has button text info
            // Since Telegram doesn't provide button text directly, we'll check the message
            // But the safest way is to check if there's a pattern in the callback data itself
            // For now, we'll try to infer from the message text or use a default
            const messageText = query.message?.text || '';
            // Check if message has approve/reject indicators
            let action = 'approve'; // Default to approve
            if (messageText.includes('رد') || messageText.includes('❌')) {
              action = 'reject';
            } else if (messageText.includes('تایید') || messageText.includes('✅')) {
              action = 'approve';
            }
            // Also check if callback data itself has approve/reject indicator
            if (data.includes('approve') || data.includes('reject')) {
              action = data.includes('approve') ? 'approve' : 'reject';
            }
            console.log(`[HR] Handling old format callback: ${data}, leaveId: ${leaveId}, inferred action: ${action}`);
            await this.processHrManagerLeaveAction(chatId, telegramId, leaveId, action);
            return true;
          }
        }

        if (data.startsWith('hr_leave_mgr_')) {
          const parts = data.split('_'); // hr leave mgr action id
          const action = parts[3];
          const leaveId = parseInt(parts[4], 10);
          if (!leaveId) {
            await this.bot.sendMessage(chatId, '❌ شناسه درخواست نامعتبر است.');
            return true;
          }
          await this.processHrManagerLeaveAction(chatId, telegramId, leaveId, action);
          return true;
        }

        if (data.startsWith('approve_leave_') || data.startsWith('reject_leave_')) {
          const parts = data.split('_'); // approve leave <id> managerX
          if (parts.length >= 4) {
            const action = parts[0]; // approve or reject
            const leaveId = parseInt(parts[2], 10);
            if (!Number.isFinite(leaveId)) {
              await this.bot.sendMessage(chatId, '❌ شناسه درخواست نامعتبر است.');
              return true;
            }
            await this.processHrManagerLeaveAction(chatId, telegramId, leaveId, action);
            return true;
          }
        }

      if (data === 'hr_leave_new') {
        await this.startHrLeaveConversation(chatId, telegramId);
        return true;
      }

      if (data.startsWith('hr_leave_type_')) {
        const leaveType = data.replace('hr_leave_type_', '');
        await this.handleHrLeaveTypeSelection(chatId, telegramId, leaveType);
        return true;
      }

      if (data === 'hr_leave_cancel') {
        this.conversations.delete(chatId);
        await this.bot.sendMessage(chatId, '❌ درخواست مرخصی لغو شد.', this.buildHrMenuKeyboard());
        return true;
      }

      if (data.startsWith('hr_leave_cancel_request_')) {
        const leaveId = parseInt(data.replace('hr_leave_cancel_request_', ''), 10);
        await this.cancelHrLeaveRequest(chatId, telegramId, leaveId);
        return true;
      }

      if (data === 'hr_leave_status') {
        await this.sendHrLeaveStatus(chatId, telegramId);
        return true;
      }

      if (data === 'hr_attendance_checkin') {
        await this.handleHrAttendanceAction(chatId, telegramId, 'checkin');
        return true;
      }

      if (data === 'hr_attendance_checkout') {
        await this.handleHrAttendanceAction(chatId, telegramId, 'checkout');
        return true;
      }

      if (data === 'hr_attendance_history') {
        await this.showHrAttendanceHistory(chatId, telegramId);
        return true;
      }

      if (data === 'hr_payroll_overview') {
        await this.showHrPayroll(chatId, telegramId);
        return true;
      }

      if (data.startsWith('datepick|')) {
        await this.handleDatePickerCallback(query, chatId, telegramId, data);
        return true;
      }

      if (data === 'menu_medical' || data === 'hr_medical_menu') {
        await this.showMedicalMenu(chatId, telegramId);
        return true;
      }

      if (data === 'medical_upload_start') {
        await this.startMedicalUploadConversation(chatId, telegramId);
        return true;
      }

      if (data === 'medical_upload_cancel') {
        await this.cancelMedicalUpload(chatId, '❌ آپلود تاییدیه لغو شد.');
        return true;
      }

      // برند
      if (data.startsWith('medical_brand_')) {
        await this.bot.answerCallbackQuery(query.id);
        const brandId = data.replace('medical_brand_', '');
        await this.handleMedicalBrandSelection(chatId, brandId);
        return true;
      }

      // کالا
      if (data.startsWith('medical_product_')) {
        const productId = data.replace('medical_product_', '');
        await this.handleMedicalProductSelection(chatId, productId);
        return true;
      }

      // فیلتر مرکز - استان (باید قبل از medical_center_ باشد)
      if (data === 'medical_center_filter_province') {
        console.log('[Medical] ✅ Found medical_center_filter_province callback');
        console.log('[Medical] Calling handleMedicalCenterFilterProvince...');
        try {
          await this.handleMedicalCenterFilterProvince(chatId);
          console.log('[Medical] ✅ handleMedicalCenterFilterProvince completed');
        } catch (error) {
          console.error('[Medical] ❌ Error in handleMedicalCenterFilterProvince:', error);
          throw error;
        }
        return true;
      }

      // فیلتر مرکز - کارشناس (باید قبل از medical_center_ باشد)
      if (data === 'medical_center_filter_personnel') {
        await this.handleMedicalCenterFilterPersonnel(chatId);
        return true;
      }

      // جستجوی مرکز (باید قبل از medical_center_ باشد)
      if (data === 'medical_center_search') {
        await this.handleMedicalCenterSearch(chatId);
        return true;
      }

      // نمایش همه مراکز (باید قبل از medical_center_ باشد)
      if (data === 'medical_center_show_all') {
        await this.promptMedicalCenter(chatId, {}, 0);
        return true;
      }

      // پاک کردن فیلتر (باید قبل از medical_center_ باشد)
      if (data === 'medical_center_clear_filter') {
        await this.promptMedicalCenter(chatId, {}, 0);
        return true;
      }

      // صفحه‌بندی مراکز (باید قبل از medical_center_ باشد)
      if (data.startsWith('medical_center_page_')) {
        const page = parseInt(data.replace('medical_center_page_', ''), 10);
        const conversation = this.conversations.get(chatId);
        if (conversation && conversation.data && conversation.data.medicalCenterFilters) {
          await this.promptMedicalCenter(chatId, conversation.data.medicalCenterFilters, page);
        } else {
          await this.promptMedicalCenter(chatId, {}, page);
        }
        return true;
      }

      // انتخاب استان برای فیلتر مرکز (باید قبل از medical_center_ باشد)
      if (data.startsWith('medical_center_province_')) {
        const shortId = data.replace('medical_center_province_', '');
        
        // Mapping از short ID به نام کامل استان
        const provinceShortIds = {
          'az_sh': 'آذربایجان شرقی',
          'az_gh': 'آذربایجان غربی',
          'ard': 'اردبیل',
          'esf': 'اصفهان',
          'alb': 'البرز',
          'ilam': 'ایلام',
          'bush': 'بوشهر',
          'teh': 'تهران',
          'khor_j': 'خراسان جنوبی',
          'khor_r': 'خراسان رضوی',
          'khor_sh': 'خراسان شمالی',
          'khoz': 'خوزستان',
          'zan': 'زنجان',
          'semn': 'سمنان',
          'sist': 'سیستان و بلوچستان',
          'fars': 'فارس',
          'qaz': 'قزوین',
          'qom': 'قم',
          'lor': 'لرستان',
          'maz': 'مازندران',
          'mark': 'مرکزی',
          'horm': 'هرمزگان',
          'ham': 'همدان',
          'chah': 'چهارمحال و بختیاری',
          'kord': 'کردستان',
          'kerm': 'کرمان',
          'kerm_sh': 'کرمانشاه',
          'koh': 'کهگیلویه و بویراحمد',
          'gol': 'گلستان',
          'gil': 'گیلان',
          'yaz': 'یزد'
        };
        
        const province = provinceShortIds[shortId] || shortId; // fallback
        await this.handleMedicalCenterProvinceSelected(chatId, province);
        return true;
      }

      // انتخاب کارشناس برای فیلتر مرکز (باید قبل از medical_center_ باشد)
      if (data.startsWith('medical_center_personnel_')) {
        const personnelId = parseInt(data.replace('medical_center_personnel_', ''), 10);
        await this.handleMedicalCenterPersonnelSelected(chatId, personnelId);
        return true;
      }

      // مرکز (باید بعد از همه medical_center_* checks باشد)
      if (data.startsWith('medical_center_')) {
        const centerId = parseInt(data.replace('medical_center_', ''), 10);
        if (!isNaN(centerId)) {
          await this.handleMedicalCenterSelection(chatId, centerId);
          return true;
        }
      }

      // استان
      if (data.startsWith('medical_province_')) {
        const shortId = data.replace('medical_province_', '');
        
        // Mapping از short ID به نام کامل استان (مطابق با نام‌های واقعی در دیتابیس)
        const provinceShortIds = {
          'az_sh': 'آذربايجان شرقي',
          'az_gh': 'آذربايجان غربي',
          'ard': 'اردبيل',
          'esf': 'اصفهان',
          'alb': 'البرز',
          'ilam': 'ايلام',
          'bush': 'بوشهر',
          'teh': 'تهران',
          'khor_j': 'خراسان جنوبي',
          'khor_r': 'خراسان رضوی',
          'khor_sh': 'خراسان شمالي',
          'khoz': 'خوزستان',
          'zan': 'زنجان',
          'semn': 'سمنان',
          'sist': 'سيستان و بلوچستان',
          'fars': 'فارس',
          'qaz': 'قزوین',
          'qom': 'قم',
          'lor': 'لرستان',
          'maz': 'مازندران',
          'mark': 'مرکزي',
          'horm': 'هرمزگان',
          'ham': 'همدان',
          'chah': 'چهارمحال و بختياري',
          'kord': 'کردستان',
          'kerm': 'کرمان',
          'kerm_sh': 'کرمانشاه',
          'koh': 'کهگيلويه و بويراحمد',
          'gol': 'گلستان',
          'gil': 'گيلان',
          'yaz': 'یزد'
        };
        
        const province = provinceShortIds[shortId] || decodeURIComponent(shortId); // fallback
        await this.handleMedicalProvinceSelection(chatId, province);
        return true;
      }

      // دسته‌بندی
      if (data.startsWith('medical_category_')) {
        const categoryId = data.replace('medical_category_', '');
        await this.handleMedicalCategorySelection(chatId, categoryId);
        return true;
      }

      if (data === 'medical_list') {
        console.log('[Medical] medical_list callback received');
        await this.showMedicalFiles(chatId, {}, 0);
        return true;
      }

      if (data.startsWith('medical_list_page_')) {
        const page = parseInt(data.replace('medical_list_page_', ''), 10);
        await this.showMedicalFiles(chatId, {}, page);
        return true;
      }

      if (data === 'medical_list_filter_brand') {
        await this.startMedicalListFilter(chatId, 'brand');
        return true;
      }

      if (data === 'medical_list_filter_product') {
        await this.startMedicalListFilter(chatId, 'product');
        return true;
      }

      if (data.startsWith('medical_list_filter_brand_')) {
        const brand = decodeURIComponent(data.replace('medical_list_filter_brand_', ''));
        await this.showMedicalFiles(chatId, { brand }, 0);
        return true;
      }

      if (data.startsWith('medical_list_filter_product_')) {
        const product = decodeURIComponent(data.replace('medical_list_filter_product_', ''));
        await this.showMedicalFiles(chatId, { product }, 0);
        return true;
      }

      if (data === 'medical_list_clear_filter') {
        await this.showMedicalFiles(chatId, {}, 0);
        return true;
      }

      if (data === 'medical_list_info') {
        // Just show info, no action needed
        await this.bot.answerCallbackQuery(query.id, { 
          text: 'برای تغییر صفحه از دکمه‌های قبلی/بعدی استفاده کنید',
          show_alert: false
        });
        return true;
      }

      if (data === 'medical_search_start') {
        await this.startMedicalSearch(chatId);
        return true;
      }

      if (data === 'medical_search_cancel') {
        this.conversations.delete(chatId);
        await this.showMedicalMenu(chatId);
        return true;
      }

      if (data.startsWith('medical_download_')) {
        const fileId = parseInt(data.replace('medical_download_', ''));
        await this.downloadAndSendMedicalFile(chatId, fileId);
        return true;
      }

      if (data === 'medical_categories') {
        await this.showMedicalCategories(chatId);
        return true;
      }

      // تایید/ویرایش نام پزشک
      if (data === 'medical_doctor_confirm') {
        await this.handleMedicalDoctorConfirm(chatId);
        return true;
      }

      if (data === 'medical_doctor_edit') {
        await this.handleMedicalDoctorEdit(chatId);
        return true;
      }

      // تایید/ویرایش تخصص پزشک
      if (data === 'medical_specialty_confirm') {
        await this.handleMedicalSpecialtyConfirm(chatId);
        return true;
      }

      if (data === 'medical_specialty_edit') {
        await this.handleMedicalSpecialtyEdit(chatId);
        return true;
      }

      // تایید/ویرایش استان
      if (data === 'medical_province_confirm') {
        await this.handleMedicalProvinceConfirm(chatId);
        return true;
      }

      if (data === 'medical_province_edit') {
        await this.handleMedicalProvinceEditRequest(chatId);
        return true;
      }

      // تایید/ویرایش توضیحات
      if (data === 'medical_description_confirm') {
        await this.handleMedicalDescriptionConfirm(chatId);
        return true;
      }

      if (data === 'medical_description_edit') {
        await this.handleMedicalDescriptionEdit(chatId);
        return true;
      }

      if (data === 'medical_description_skip') {
        await this.handleMedicalDescriptionSkip(chatId);
        return true;
      }
    } catch (error) {
      console.error('[HR] Callback error:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در عملیات HR: ${error.message}`);
      return true;
    }

    return false;
  }

  async showHrMenu(chatId, telegramId) {
    const ctx = await this.prepareHrContext(telegramId, chatId);
    if (!ctx) return;

    const { personnel, employee } = ctx;
    const remaining = this.formatHrNumber(employee?.remaining_leave_days ?? 0);
    const total = this.formatHrNumber(employee?.total_leave_days ?? 0);
    const hourlyRate = this.formatCurrencyValue(employee?.hourly_rate ?? 0);

    const message =
      `👥 *منابع انسانی*\n\n` +
      `نام: ${personnel.name || 'نامشخص'}\n` +
      `شماره پرسنلی HR: ${employee.id}\n` +
      `موجودی مرخصی: ${remaining} از ${total} روز\n` +
      `نرخ ساعتی: ${hourlyRate} تومان`;

    await this.bot.sendMessage(chatId, message, this.buildHrMenuKeyboard());
  }

  async handleHrLeaveConversationMessage(msg, conversation) {
    const chatId = msg.chat.id;
    const rawText = (msg.text || '').trim();
    const text = this.normalizeDigits(rawText);

    if (this.isCancelCommand(text)) {
      this.conversations.delete(chatId);
      await this.bot.sendMessage(chatId, '❌ درخواست مرخصی لغو شد.', this.buildHrMenuKeyboard());
      return;
    }

    const data = conversation.data || (conversation.data = {});

    switch (conversation.step) {
      case 'hr_leave_start_date': {
        const dateStr = this.parseDateInput(text);
        if (!dateStr) {
          await this.bot.sendMessage(chatId, '❌ فرمت تاریخ نامعتبر است. لطفاً به صورت YYYY-MM-DD وارد کنید.');
          return;
        }
        data.startDate = dateStr;
        await this.bot.sendMessage(chatId, `✅ تاریخ شروع انتخاب شد: ${this.formatPersianDate(dateStr)}`);
        conversation.step = 'hr_leave_end_date';
        this.conversations.set(chatId, conversation);
        await this.promptDateSelection(chatId, conversation, {
          pickerId: 'hr_leave_end_date',
          title: '📅 تاریخ پایان مرخصی را انتخاب کنید:',
          baseDate: dateStr,
          cancelCallback: 'hr_leave_cancel'
        });
        return;
      }
      case 'hr_leave_end_date': {
        const dateStr = this.parseDateInput(text);
        if (!dateStr) {
          await this.bot.sendMessage(chatId, '❌ فرمت تاریخ نامعتبر است. لطفاً به صورت YYYY-MM-DD وارد کنید.');
          return;
        }
        if (!data.startDate) {
          await this.bot.sendMessage(chatId, '❌ ابتدا تاریخ شروع را وارد کنید.');
          return;
        }
        const daysCount = this.calculateDaysCount(data.startDate, dateStr);
        if (daysCount <= 0) {
          await this.bot.sendMessage(chatId, '❌ تاریخ پایان باید بعد از تاریخ شروع باشد.');
          return;
        }
        data.endDate = dateStr;
        data.daysCount = daysCount;
        await this.bot.sendMessage(chatId, `✅ تاریخ پایان انتخاب شد: ${this.formatPersianDate(dateStr)}`);
        conversation.step = 'hr_leave_reason';
        this.conversations.set(chatId, conversation);
        await this.bot.sendMessage(chatId,
          '💬 دلیل مرخصی را وارد کنید (یا "-" برای رد کردن):'
        );
        return;
      }
      case 'hr_leave_hourly_date': {
        const dateStr = this.parseDateInput(text);
        if (!dateStr) {
          await this.bot.sendMessage(chatId, '❌ فرمت تاریخ نامعتبر است. لطفاً به صورت YYYY-MM-DD وارد کنید.');
          return;
        }
        data.startDate = dateStr;
        data.endDate = dateStr;
        await this.bot.sendMessage(chatId, `✅ تاریخ انتخاب شد: ${this.formatPersianDate(dateStr)}`);
        conversation.step = 'hr_leave_hourly_start_time';
        this.conversations.set(chatId, conversation);
        await this.bot.sendMessage(chatId, '⏰ ساعت شروع را وارد کنید (HH:mm):');
        return;
      }
      case 'hr_leave_hourly_start_time': {
        const timeStr = this.parseTimeInput(text);
        if (!timeStr) {
          await this.bot.sendMessage(chatId, '❌ فرمت ساعت نامعتبر است. مثال: 08:30');
          return;
        }
        data.startTime = timeStr;
        conversation.step = 'hr_leave_hourly_end_time';
        this.conversations.set(chatId, conversation);
        await this.bot.sendMessage(chatId, '⏰ ساعت پایان را وارد کنید (HH:mm):');
        return;
      }
      case 'hr_leave_hourly_end_time': {
        const timeStr = this.parseTimeInput(text);
        if (!timeStr) {
          await this.bot.sendMessage(chatId, '❌ فرمت ساعت نامعتبر است. مثال: 17:45');
          return;
        }
        if (!data.startTime) {
          await this.bot.sendMessage(chatId, '❌ ابتدا ساعت شروع را وارد کنید.');
          return;
        }
        const hours = this.calculateHourlyDuration(data.startDate, data.startTime, timeStr);
        if (hours <= 0) {
          await this.bot.sendMessage(chatId, '❌ ساعت پایان باید بعد از ساعت شروع باشد.');
          return;
        }
        data.endTime = timeStr;
        data.hoursCount = hours;
        data.daysCount = hours / 8;
        conversation.step = 'hr_leave_reason';
        this.conversations.set(chatId, conversation);
        await this.bot.sendMessage(chatId,
          '💬 دلیل مرخصی را وارد کنید (یا "-" برای رد کردن):'
        );
        return;
      }
      case 'hr_leave_reason': {
        data.reason = text === '-' ? null : rawText;
        await this.finalizeHrLeaveRequest(chatId, conversation);
        return;
      }
      default:
        await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است. لطفاً دوباره تلاش کنید.');
        this.conversations.delete(chatId);
        return;
    }
  }

  async finalizeHrLeaveRequest(chatId, conversation) {
    const data = conversation.data || {};
    try {
      if (data.leaveType !== 'hourly') {
        const allowance = Number(data.remainingDays || 0);
        if (allowance && data.daysCount > allowance) {
          await this.bot.sendMessage(chatId,
            `❌ موجودی مرخصی کافی نیست. موجودی فعلی: ${this.formatHrNumber(allowance)} روز`
          );
          this.conversations.delete(chatId);
          return;
        }
      }

      const payload = {
        employee_id: data.employeeId,
        leave_type: data.leaveType,
        start_date: data.startDate,
        end_date: data.endDate,
        days_count: data.daysCount || 0,
        hours_count: data.hoursCount || 0,
        reason: data.reason || null
      };

      if (data.leaveType === 'hourly') {
        payload.start_time = data.startTime;
        payload.end_time = data.endTime;
      }

      const response = await HrApi.createLeaveRequest(payload);
      this.conversations.delete(chatId);

      const statusLabel = this.mapHrStatus(response.status);
      await this.bot.sendMessage(chatId,
        `✅ درخواست مرخصی ثبت شد!\n\n` +
        `نوع: ${this.mapLeaveTypeLabel(data.leaveType)}\n` +
        `از ${response.start_date} تا ${response.end_date}\n` +
        `وضعیت: ${statusLabel}\n\n` +
        `🆔 شناسه: ${response.id}`,
        this.buildHrMenuKeyboard()
      );
    } catch (error) {
      console.error('[HR] finalize leave error:', error);
      await this.bot.sendMessage(chatId, `❌ ثبت مرخصی با خطا مواجه شد: ${error.message}`);
    }
  }

  async cancelHrLeaveRequest(chatId, telegramId, leaveId) {
    if (!leaveId) {
      await this.bot.sendMessage(chatId, '❌ شناسه درخواست نامعتبر است.');
      return;
    }

    const ctx = await this.prepareHrContext(telegramId, chatId);
    if (!ctx) return;

    try {
      await HrApi.cancelLeaveRequest({
        leaveId,
        employeeId: ctx.employee.id
      });

      await this.bot.sendMessage(chatId,
        `✅ درخواست مرخصی شماره ${leaveId} لغو شد.`,
        this.buildHrMenuKeyboard()
      );
    } catch (error) {
      console.error('[HR] cancel leave error:', error);
      await this.bot.sendMessage(chatId, `❌ لغو درخواست با خطا مواجه شد: ${error.message}`);
    }
  }

  async processHrManagerLeaveAction(chatId, telegramId, leaveId, action) {
    const requester = await Personnel.getByTelegramId(telegramId);
    if (!requester) {
      await this.bot.sendMessage(chatId, '❌ شناسه مدیر نامعتبر است.');
      return;
    }
    
    // بررسی نقش مدیر
    const role = (requester.role || '').toLowerCase();
    const isManager = ['admin', 'manager', 'super_admin', 'owner'].includes(role);
    if (!isManager) {
      await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند درخواست‌های مرخصی را تایید یا رد کنند.');
      return;
    }
    
    try {
      const normalizedAction = action === 'approve' ? 'approve' : 'reject';
      await HrApi.managerApproveLeave({
        leaveId,
        action: normalizedAction,
        telegramId
      });
      const label = normalizedAction === 'approve' ? '✅ درخواست تایید شد.' : '❌ درخواست رد شد.';
      await this.bot.sendMessage(chatId, `${label}\n🆔 شناسه: ${leaveId}`, this.buildHrMenuKeyboard());
    } catch (error) {
      console.error('[HR] manager approval error:', error);
      console.error('[HR] Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message,
        leaveId,
        action,
        telegramId
      });
      
      let message = 'خطای نامشخص';
      if (error?.response?.status === 404) {
        message = `درخواست مرخصی #${leaveId} یافت نشد.`;
      } else if (error?.response?.status === 403) {
        message = 'شما دسترسی تایید/رد این درخواست را ندارید.';
      } else if (error?.response?.data?.detail) {
        message = error.response.data.detail;
      } else if (error?.message) {
        message = error.message;
      }
      
      await this.bot.sendMessage(chatId, `❌ خطا در پردازش تایید/رد: ${message}`);
    }
  }

  mapLeaveTypeLabel(type) {
    const map = {
      annual: 'سالانه',
      sick: 'استعلاجی',
      emergency: 'فوری',
      hourly: 'ساعتی'
    };
    return map[type] || type;
  }

  normalizeAiLeaveType(type) {
    const map = {
      'annual': 'annual',
      'سالانه': 'annual',
      'استحقاقی': 'annual',
      'مرخصی سالانه': 'annual',
      'sick': 'sick',
      'sickness': 'sick',
      'استعلاجی': 'sick',
      'بیماری': 'sick',
      'emergency': 'emergency',
      'فوری': 'emergency',
      'اضطراری': 'emergency',
      'hourly': 'hourly',
      'ساعتی': 'hourly'
    };
    const normalized = (type || '').toString().trim().toLowerCase();
    return map[normalized] || 'annual';
  }

  async startMedicalUploadConversation(chatId, telegramId) {
    const personnel = await Personnel.getByTelegramId(telegramId);
    if (!personnel) {
      await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
      return;
    }

    this.conversations.set(chatId, {
      step: 'medical_upload_wait_file',
      telegramId,
      data: {
        personnelId: personnel.id
      }
    });

    await this.bot.sendMessage(
      chatId,
      '📤 *آپلود تاییدیه*\n\nلطفاً فایل تاییدیه (pdf یا عکس) را ارسال کنید.',
      {
        ...this.buildMedicalUploadCancelKeyboard(),
        parse_mode: 'Markdown'
      }
    );
  }

  async handleMedicalUploadConversationMessage(msg, conversation) {
    const chatId = msg.chat.id;
    const rawText = (msg.text || '').trim();
    const text = this.normalizeDigits(rawText);

    if (this.isCancelCommand(text)) {
      await this.cancelMedicalUpload(chatId, '❌ آپلود تاییدیه لغو شد.');
      return;
    }

    const data = conversation.data || (conversation.data = {});

    switch (conversation.step) {
      case 'medical_center_search': {
        if (this.isCancelCommand(text)) {
          conversation.step = 'medical_upload_center';
          this.conversations.set(chatId, conversation);
          await this.promptMedicalCenter(chatId, {}, 0);
          return;
        }
        
        if (!rawText) {
          await this.bot.sendMessage(chatId, '❌ لطفاً نام مرکز را وارد کنید یا "لغو" را بزنید.');
          return;
        }

        // جستجوی مراکز بر اساس نام - استفاده از promptMedicalCenter با صفحه‌بندی
        conversation.step = 'medical_upload_center';
        this.conversations.set(chatId, conversation);
        await this.promptMedicalCenter(chatId, { search: rawText }, 0);
        return;
      }
      case 'medical_upload_wait_file': {
        const filePayload = await this.extractTelegramFile(msg);
        if (!filePayload) {
          await this.bot.sendMessage(chatId,
            '❌ ابتدا باید فایل (تصویر یا PDF) را ارسال کنید.',
            this.buildMedicalUploadCancelKeyboard()
          );
          return;
        }
        Object.assign(data, filePayload);
        
        // استفاده از اطلاعات AI اگر موجود باشد
        const aiExtracted = data.aiExtracted || {};
        
        // اگر برند از AI آمده باشد، خودکار انتخاب می‌کنیم
        if (aiExtracted.brand) {
          data.brand = aiExtracted.brand;
          conversation.step = 'medical_upload_product';
          this.conversations.set(chatId, conversation);
          await this.promptMedicalProduct(chatId, aiExtracted.brand);
          return;
        }
        
        conversation.step = 'medical_upload_brand';
        this.conversations.set(chatId, conversation);
        await this.promptMedicalBrand(chatId);
        return;
      }
      case 'medical_upload_doctor_name': {
        if (!rawText) {
          await this.bot.sendMessage(chatId, '❌ نام پزشک نمی‌تواند خالی باشد.');
          return;
        }
        data.doctorName = rawText;
        
        // اگر تخصص از AI آمده، می‌پرسیم تایید یا ویرایش؟
        const aiExtracted = data.aiExtracted || {};
        if (aiExtracted.specialty) {
          data.doctorSpecialty = aiExtracted.specialty;
          conversation.step = 'medical_upload_doctor_specialty_confirm';
          this.conversations.set(chatId, conversation);
          
          await this.bot.sendMessage(chatId,
            `🩺 *تخصص پزشک:*\n\n` +
            `✅ تخصص تشخیص داده‌شده: ${aiExtracted.specialty}\n\n` +
            `این تخصص را تایید می‌کنید یا تغییر می‌دهید؟`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ تایید', callback_data: 'medical_specialty_confirm' }],
                  [{ text: '✏️ ویرایش', callback_data: 'medical_specialty_edit' }],
                  [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
                ]
              },
              parse_mode: 'Markdown'
            }
          );
          return;
        }
        
        conversation.step = 'medical_upload_doctor_specialty';
        this.conversations.set(chatId, conversation);
        await this.bot.sendMessage(chatId,
          '🏥 تخصص پزشک را وارد کنید:',
          this.buildMedicalUploadCancelKeyboard()
        );
        return;
      }
      case 'medical_upload_doctor_specialty': {
        if (!rawText) {
          await this.bot.sendMessage(chatId, '❌ تخصص پزشک نمی‌تواند خالی باشد.');
          return;
        }
        data.doctorSpecialty = rawText;
        
        // اگر استان از AI آمده، پیش‌پر می‌کنیم
        const aiExtracted = data.aiExtracted || {};
        if (aiExtracted.province) {
          data.province = aiExtracted.province;
          conversation.step = 'medical_upload_province_confirm';
          this.conversations.set(chatId, conversation);
          
          await this.bot.sendMessage(chatId,
            `📍 *استان:*\n\n` +
            `✅ استان تشخیص داده‌شده: ${aiExtracted.province}\n\n` +
            `این استان را تایید می‌کنید؟`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ تایید', callback_data: 'medical_province_confirm' }],
                  [{ text: '✏️ انتخاب استان دیگر', callback_data: 'medical_province_edit' }],
                  [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
                ]
              },
              parse_mode: 'Markdown'
            }
          );
          return;
        }
        
        conversation.step = 'medical_upload_province';
        this.conversations.set(chatId, conversation);
        await this.promptMedicalProvince(chatId);
        return;
      }
      case 'medical_upload_description': {
        // اگر AI توضیحاتی داده و کاربر "-" فرستاده، از توضیحات AI استفاده می‌کنیم
        const aiExtracted = data.aiExtracted || {};
        if (text === '-' && aiExtracted.description) {
          data.description = aiExtracted.description;
        } else {
          data.description = text === '-' ? null : rawText;
        }
        
        conversation.step = 'medical_upload_category';
        this.conversations.set(chatId, conversation);
        await this.promptMedicalCategory(chatId, conversation);
        return;
      }
      default:
        // برای مراحل دیگر (brand, product, center, province, category) از callback استفاده می‌شود
        await this.bot.sendMessage(chatId, '❌ لطفاً از دکمه‌های ارائه شده استفاده کنید.');
        return;
    }
  }

  // برند
  async promptMedicalBrand(chatId) {
    // استفاده از ID کوتاه برای جلوگیری از خطای BUTTON_DATA_INVALID (حداکثر 64 بایت)
    const brands = [
      { id: 'blueneem', name: 'Blueneem' },
      { id: 'geotek', name: 'Geotek' },
      { id: 'curaway', name: 'Curaway' },
      { id: 'intra', name: 'Intra Special Catheters' },
      { id: 'ares', name: 'Ares' }
    ];
    const keyboard = {
      reply_markup: {
        inline_keyboard: brands.map(brand => ([
          { text: brand.name, callback_data: `medical_brand_${brand.id}` }
        ])).concat([[{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]])
      }
    };

    await this.bot.sendMessage(chatId,
      '🏷️ *برند را انتخاب کنید:*',
      { ...keyboard, parse_mode: 'Markdown' }
    );
  }

  async handleMedicalBrandSelection(chatId, brandId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_brand') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // تبدیل ID به نام کامل برند
    const brandMap = {
      'blueneem': 'Blueneem',
      'geotek': 'Geotek',
      'curaway': 'Curaway',
      'intra': 'Intra Special Catheters',
      'ares': 'Ares'
    };

    const brand = brandMap[brandId] || brandId;

    conversation.data = conversation.data || {};
    conversation.data.brand = brand;
    conversation.step = 'medical_upload_product';
    this.conversations.set(chatId, conversation);
    await this.promptMedicalProduct(chatId);
  }

  // کالا
  async promptMedicalProduct(chatId) {
    // استفاده از ID کوتاه برای جلوگیری از خطای BUTTON_DATA_INVALID
    const products = [
      { id: 'nephro', name: 'ست نفروستومی' },
      { id: 'biopsy', name: 'سوزن بیوپسی' },
      { id: 'arterial', name: 'کاتتر آرتر لاین' },
      { id: 'hemodialysis', name: 'کاتتر همودیالیز' }
    ];
    const keyboard = {
      reply_markup: {
        inline_keyboard: products.map(product => ([
          { text: product.name, callback_data: `medical_product_${product.id}` }
        ])).concat([[{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]])
      }
    };

    await this.bot.sendMessage(chatId,
      '📦 *کالا را انتخاب کنید:*',
      { ...keyboard, parse_mode: 'Markdown' }
    );
  }

  async handleMedicalProductSelection(chatId, productId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_product') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // تبدیل ID به نام کامل کالا
    const productMap = {
      'nephro': 'ست نفروستومی',
      'biopsy': 'سوزن بیوپسی',
      'arterial': 'کاتتر آرتر لاین',
      'hemodialysis': 'کاتتر همودیالیز'
    };

    const product = productMap[productId] || productId;

    conversation.data = conversation.data || {};
    conversation.data.product = product;
    conversation.step = 'medical_upload_center';
    this.conversations.set(chatId, conversation);
    
    // اگر نام مرکز از AI آمده، با آن فیلتر می‌کنیم
    const aiExtracted = conversation.data.aiExtracted || {};
    const centerFilter = aiExtracted.centerName ? { search: aiExtracted.centerName } : {};
    
    await this.promptMedicalCenter(chatId, centerFilter, 0);
  }

  // مرکز
  async promptMedicalCenter(chatId, filters = {}, page = 0) {
    try {
      console.log(`[Medical] promptMedicalCenter called with filters:`, JSON.stringify(filters, null, 2), `page: ${page}`);
      
      // ذخیره فیلترها و صفحه در conversation
      let conversation = this.conversations.get(chatId);
      if (conversation) {
        conversation.data = conversation.data || {};
        conversation.data.medicalCenterFilters = filters;
        conversation.data.medicalCenterPage = page;
        this.conversations.set(chatId, conversation);
      }
      
      const filterOptions = {
        isActive: true,
        ...filters
      };

      console.log(`[Medical] Filter options:`, JSON.stringify(filterOptions, null, 2));
      
      // اگر فیلتر city داریم، بررسی کنیم که آیا مراکزی با این city وجود دارند
      if (filterOptions.city) {
        const db = getDB();
        const checkQuery = `SELECT COUNT(*) as total FROM centers WHERE isActive = 1 AND city = ?`;
        const checkResult = await db.get(checkQuery, [filterOptions.city]);
        console.log(`[Medical] Centers with city="${filterOptions.city}": ${checkResult.total}`);
        
        // همچنین بررسی کنیم که آیا نام city دقیقاً مطابقت دارد یا نه
        const sampleQuery = `SELECT id, name, city FROM centers WHERE isActive = 1 AND city LIKE ? LIMIT 5`;
        const sampleRows = await db.all(sampleQuery, [`%${filterOptions.city}%`]);
        console.log(`[Medical] Sample centers with city LIKE "${filterOptions.city}":`, JSON.stringify(sampleRows, null, 2));
        
        // اگر با = پیدا نشد، از LIKE استفاده کنیم
        if (checkResult.total === 0 && sampleRows.length > 0) {
          console.log(`[Medical] Exact match failed, but LIKE found ${sampleRows.length} centers. Using LIKE filter.`);
          // استفاده از search به جای city برای فیلتر LIKE
          filterOptions.search = filterOptions.city;
          delete filterOptions.city;
        }
      }

      const allCenters = await Center.getAll(filterOptions);
      console.log(`[Medical] Center.getAll returned ${allCenters.length} centers`);
      
      if (allCenters.length === 0) {
        await this.bot.sendMessage(chatId,
          '❌ هیچ مرکزی با فیلتر انتخابی یافت نشد.',
          this.buildMedicalCenterFilterKeyboard()
        );
        return;
      }

      // صفحه‌بندی
      const centersPerPage = 10;
      const totalPages = Math.ceil(allCenters.length / centersPerPage);
      const centersToShow = allCenters.slice(page * centersPerPage, (page + 1) * centersPerPage);
      console.log(`[Medical] Pagination: totalCenters=${allCenters.length}, page=${page}, totalPages=${totalPages}, centersToShow=${centersToShow.length}`);

      const keyboard = {
        reply_markup: {
          inline_keyboard: []
        }
      };

      // نمایش دکمه‌های فیلتر در بالای لیست
      const filterButtons = [
        [
          { text: '🔍 جستجو', callback_data: 'medical_center_search' },
          { text: '📍 فیلتر استان', callback_data: 'medical_center_filter_province' }
        ],
        [
          { text: '👤 فیلتر کارشناس', callback_data: 'medical_center_filter_personnel' },
          { text: '🔄 نمایش همه', callback_data: 'medical_center_show_all' }
        ]
      ];

      // اگر فیلتر فعال است، دکمه پاک کردن فیلتر اضافه کن
      if (filters.province || filters.city || filters.responsiblePersonnelId) {
        filterButtons.push([{ text: '❌ پاک کردن فیلتر', callback_data: 'medical_center_clear_filter' }]);
      }

      // دکمه‌های مراکز
      const centerButtons = centersToShow.map(center => ([
        { 
          text: `${center.name}${center.city ? ` (${center.city})` : ''}${center.province ? ` - ${center.province}` : ''}`, 
          callback_data: `medical_center_${center.id}` 
        }
      ]));

      // دکمه‌های navigation (صفحه‌بندی)
      const navButtons = [];
      if (page > 0) {
        navButtons.push({ text: '◀️ قبلی', callback_data: `medical_center_page_${page - 1}` });
      }
      if (page < totalPages - 1) {
        navButtons.push({ text: '▶️ بعدی', callback_data: `medical_center_page_${page + 1}` });
      }
      console.log(`[Medical] Navigation buttons: page=${page}, totalPages=${totalPages}, navButtons.length=${navButtons.length}`);

      const buttons = filterButtons.concat(centerButtons);
      
      // اضافه کردن دکمه‌های navigation اگر وجود دارند
      if (navButtons.length > 0) {
        buttons.push(navButtons);
        console.log(`[Medical] Added navigation buttons to keyboard`);
      } else {
        console.log(`[Medical] No navigation buttons to add (page=${page}, totalPages=${totalPages})`);
      }

      buttons.push([{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]);
      keyboard.reply_markup.inline_keyboard = buttons;

      let message = '🏥 *مرکز را از لیست انتخاب کنید:*\n\n';
      if (filters.province) {
        message += `📍 فیلتر استان: ${filters.province}\n`;
      }
      if (filters.city) {
        message += `📍 فیلتر استان/شهر: ${filters.city}\n`;
      }
      if (filters.responsiblePersonnelId) {
        const personnel = await Personnel.getById(filters.responsiblePersonnelId);
        if (personnel) {
          message += `👤 فیلتر کارشناس: ${personnel.name}\n`;
        }
      }
      message += `\n📊 تعداد کل: ${allCenters.length} مرکز`;
      if (totalPages > 1) {
        message += `\n📄 صفحه ${page + 1} از ${totalPages}`;
      }

      await this.bot.sendMessage(chatId, message, {
        ...keyboard,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[Medical] center fetch error:', error);
      await this.bot.sendMessage(chatId,
        '⚠️ دریافت لیست مراکز با خطا مواجه شد. لطفاً بعداً تلاش کنید.',
        this.buildMedicalUploadCancelKeyboard()
      );
    }
  }

  buildMedicalCenterFilterKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 جستجو', callback_data: 'medical_center_search' },
            { text: '📍 فیلتر استان', callback_data: 'medical_center_filter_province' }
          ],
          [
            { text: '👤 فیلتر کارشناس', callback_data: 'medical_center_filter_personnel' },
            { text: '🔄 نمایش همه', callback_data: 'medical_center_show_all' }
          ],
          [
            { text: '❌ لغو', callback_data: 'medical_upload_cancel' }
          ]
        ]
      }
    };
  }

  async handleMedicalCenterSelection(chatId, centerId) {
    const conversation = this.conversations.get(chatId);
    // پذیرش هم medical_upload_center و هم medical_center_search (بعد از جستجو)
    if (!conversation || (conversation.step !== 'medical_upload_center' && conversation.step !== 'medical_center_search')) {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.data = conversation.data || {};
    conversation.data.centerId = centerId;
    
    // اگر نام پزشک از AI آمده، آن را پیش‌پر می‌کنیم و می‌پرسیم تایید یا ویرایش؟
    const aiExtracted = conversation.data.aiExtracted || {};
    if (aiExtracted.doctorName) {
      conversation.data.doctorName = aiExtracted.doctorName;
      conversation.step = 'medical_upload_doctor_name_confirm';
      this.conversations.set(chatId, conversation);
      
      await this.bot.sendMessage(chatId,
        `👨‍⚕️ *نام پزشک:*\n\n` +
        `✅ نام تشخیص داده‌شده: ${aiExtracted.doctorName}\n\n` +
        `این نام را تایید می‌کنید یا نام دیگری می‌خواهید؟`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ تایید', callback_data: 'medical_doctor_confirm' }],
              [{ text: '✏️ ویرایش', callback_data: 'medical_doctor_edit' }],
              [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
            ]
          },
          parse_mode: 'Markdown'
        }
      );
      return;
    }
    
    conversation.step = 'medical_upload_doctor_name';
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId,
      '👨‍⚕️ *نام پزشک را وارد کنید:*',
      { ...this.buildMedicalUploadCancelKeyboard(), parse_mode: 'Markdown' }
    );
  }

  // استان
  async promptMedicalProvince(chatId) {
    try {
      console.log('[Medical] promptMedicalProvince called');
      const db = getDB();
      
      // ابتدا از province استفاده کنیم
      const provinceQuery = `SELECT DISTINCT province FROM centers WHERE isActive = 1 AND province IS NOT NULL AND province != '' ORDER BY province ASC`;
      const provinceRows = await db.all(provinceQuery);
      let provinces = provinceRows.map(row => row.province).filter(Boolean);
      
      console.log(`[Medical] Provinces from province field: ${provinces.length}`);
      
      // اگر province پیدا نشد، از city استفاده کنیم
      if (provinces.length === 0) {
        console.log('[Medical] No provinces found, trying to use city as province...');
        const cityQuery = `SELECT DISTINCT city FROM centers WHERE isActive = 1 AND city IS NOT NULL AND city != '' ORDER BY city ASC`;
        const cityRows = await db.all(cityQuery);
        provinces = cityRows.map(row => row.city).filter(Boolean);
        console.log(`[Medical] Using cities as provinces: ${provinces.length}`);
      }
      
      if (provinces.length === 0) {
        await this.bot.sendMessage(chatId,
          '❌ هیچ استانی در سیستم ثبت نشده است.',
          this.buildMedicalUploadCancelKeyboard()
        );
        return;
      }

      // Mapping از short ID به نام کامل استان (مثل handleMedicalCenterFilterProvince)
      // توجه: نام‌ها باید دقیقاً با نام‌های موجود در دیتابیس مطابقت داشته باشند
      const provinceShortIds = {
        'az_sh': 'آذربايجان شرقي',
        'az_gh': 'آذربايجان غربي',
        'ard': 'اردبيل',
        'esf': 'اصفهان',
        'alb': 'البرز',
        'ilam': 'ايلام',
        'bush': 'بوشهر',
        'teh': 'تهران',
        'khor_j': 'خراسان جنوبي',
        'khor_r': 'خراسان رضوی',
        'khor_sh': 'خراسان شمالي',
        'khoz': 'خوزستان',
        'zan': 'زنجان',
        'semn': 'سمنان',
        'sist': 'سيستان و بلوچستان',
        'fars': 'فارس',
        'qaz': 'قزوین',
        'qom': 'قم',
        'lor': 'لرستان',
        'maz': 'مازندران',
        'mark': 'مرکزي',
        'horm': 'هرمزگان',
        'ham': 'همدان',
        'chah': 'چهارمحال و بختياري',
        'kord': 'کردستان',
        'kerm': 'کرمان',
        'kerm_sh': 'کرمانشاه',
        'koh': 'کهگيلويه و بويراحمد',
        'gol': 'گلستان',
        'gil': 'گيلان',
        'yaz': 'یزد'
      };
      
      // ایجاد reverse mapping از نام استان به short ID
      const provinceToShortId = {};
      Object.entries(provinceShortIds).forEach(([shortId, fullName]) => {
        provinceToShortId[fullName] = shortId;
      });

      console.log(`[Medical] Total provinces: ${provinces.length}`);
      console.log(`[Medical] Sample provinces (first 5):`, provinces.slice(0, 5));
      console.log(`[Medical] Mapping keys (first 5):`, Object.keys(provinceToShortId).slice(0, 5));

      const keyboard = {
        reply_markup: {
          inline_keyboard: []
        }
      };

      // استفاده از short IDs برای callback_data
      const buttons = provinces.map(province => {
        // استفاده از mapping یا fallback به short ID بر اساس index
        let shortId = provinceToShortId[province];
        if (!shortId) {
          // اگر mapping پیدا نشد، از index استفاده کنیم
          const index = provinces.indexOf(province);
          shortId = `p${index}`;
          console.log(`[Medical] ⚠️ No mapping found for province "${province}", using index-based short ID: ${shortId}`);
        }
        const callbackData = `medical_province_${shortId}`;
        const callbackDataLength = Buffer.byteLength(callbackData, 'utf8');
        if (callbackDataLength > 64) {
          console.error(`[Medical] ❌ ERROR: callback_data too long! "${callbackData}" (${callbackDataLength} bytes)`);
        } else {
          console.log(`[Medical] ✅ Province: "${province}" -> shortId: "${shortId}" -> callback_data: "${callbackData}" (${callbackDataLength} bytes)`);
        }
        return [
          { text: province, callback_data: callbackData }
        ];
      });

      buttons.push([{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]);
      keyboard.reply_markup.inline_keyboard = buttons;

      await this.bot.sendMessage(chatId,
        '📍 *استان را انتخاب کنید:*',
        { ...keyboard, parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[Medical] province fetch error:', error);
      await this.bot.sendMessage(chatId,
        '⚠️ دریافت لیست استان‌ها با خطا مواجه شد. لطفاً بعداً تلاش کنید.',
        this.buildMedicalUploadCancelKeyboard()
      );
    }
  }

  async handleMedicalProvinceSelection(chatId, province) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_province') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.data = conversation.data || {};
    conversation.data.province = province;
    
    // اگر توضیحات از AI آمده، پیش‌نمایش و تایید می‌دهیم
    const aiExtracted = conversation.data.aiExtracted || {};
    if (aiExtracted.description) {
      conversation.data.description = aiExtracted.description;
      conversation.step = 'medical_upload_description_confirm';
      this.conversations.set(chatId, conversation);
      
      await this.bot.sendMessage(chatId,
        `📝 *توضیحات:*\n\n` +
        `✅ توضیحات تشخیص داده‌شده:\n${aiExtracted.description}\n\n` +
        `این توضیحات را تایید می‌کنید یا ویرایش می‌کنید؟`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ تایید', callback_data: 'medical_description_confirm' }],
              [{ text: '✏️ ویرایش', callback_data: 'medical_description_edit' }],
              [{ text: '⏭️ بدون توضیحات', callback_data: 'medical_description_skip' }],
              [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
            ]
          },
          parse_mode: 'Markdown'
        }
      );
      return;
    }
    
    conversation.step = 'medical_upload_description';
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId,
      '📝 *توضیحات اضافی را وارد کنید:*',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ رد کردن', callback_data: 'medical_description_skip' }],
            [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }

  // ========== فیلتر مرکز - استان ==========
  async handleMedicalCenterFilterProvince(chatId) {
    console.log('[Medical] handleMedicalCenterFilterProvince called for chatId:', chatId);
    try {
      const db = getDB();
      console.log('[Medical] Database connection obtained');
      
      // ابتدا بررسی کنیم که آیا اصلاً مراکزی در دیتابیس وجود دارد
      console.log('[Medical] Checking if centers table has any data...');
      const countQuery = `SELECT COUNT(*) as total FROM centers`;
      const countResult = await db.get(countQuery);
      console.log(`[Medical] Total centers in database: ${countResult.total}`);
      
      // بررسی نمونه مراکز
      const sampleQuery = `SELECT id, name, province, city, isActive FROM centers LIMIT 5`;
      const sampleRows = await db.all(sampleQuery);
      console.log(`[Medical] Sample centers (${sampleRows.length}):`, JSON.stringify(sampleRows, null, 2));
      
      // بررسی اینکه آیا فیلد province در جدول وجود دارد
      const tableInfoQuery = `PRAGMA table_info(centers)`;
      const tableInfo = await db.all(tableInfoQuery);
      const hasProvinceColumn = tableInfo.some(col => col.name === 'province');
      console.log(`[Medical] Has province column: ${hasProvinceColumn}`);
      console.log(`[Medical] Table columns:`, tableInfo.map(col => col.name).join(', '));
      
      // ابتدا یک query ساده از centers
      console.log('[Medical] Trying query from centers table...');
      
      // بررسی مراکزی که province دارند (بدون فیلتر isActive)
      const allCentersWithProvinceQuery = `SELECT COUNT(*) as total FROM centers WHERE province IS NOT NULL AND province != ''`;
      const allCentersWithProvinceResult = await db.get(allCentersWithProvinceQuery);
      console.log(`[Medical] Centers with province (no isActive filter): ${allCentersWithProvinceResult.total}`);
      
      // بررسی مراکزی که province دارند و isActive = 1
      const activeCentersWithProvinceQuery = `SELECT COUNT(*) as total FROM centers WHERE isActive = 1 AND province IS NOT NULL AND province != ''`;
      const activeCentersWithProvinceResult = await db.get(activeCentersWithProvinceQuery);
      console.log(`[Medical] Active centers with province: ${activeCentersWithProvinceResult.total}`);
      
      // بررسی نمونه مراکزی که province دارند
      const sampleWithProvinceQuery = `SELECT id, name, province, city, isActive FROM centers WHERE province IS NOT NULL AND province != '' LIMIT 5`;
      const sampleWithProvinceRows = await db.all(sampleWithProvinceQuery);
      console.log(`[Medical] Sample centers with province (${sampleWithProvinceRows.length}):`, JSON.stringify(sampleWithProvinceRows, null, 2));
      
      // بررسی مراکزی که city دارند (شاید استان در city باشد)
      const centersWithCityQuery = `SELECT COUNT(*) as total FROM centers WHERE city IS NOT NULL AND city != ''`;
      const centersWithCityResult = await db.get(centersWithCityQuery);
      console.log(`[Medical] Centers with city: ${centersWithCityResult.total}`);
      
      // بررسی نمونه مراکزی که city دارند
      const sampleWithCityQuery = `SELECT id, name, province, city, address FROM centers WHERE city IS NOT NULL AND city != '' LIMIT 5`;
      const sampleWithCityRows = await db.all(sampleWithCityQuery);
      console.log(`[Medical] Sample centers with city (${sampleWithCityRows.length}):`, JSON.stringify(sampleWithCityRows, null, 2));
      
      // بررسی مراکزی که address دارند (شاید استان در address باشد)
      const centersWithAddressQuery = `SELECT COUNT(*) as total FROM centers WHERE address IS NOT NULL AND address != ''`;
      const centersWithAddressResult = await db.get(centersWithAddressQuery);
      console.log(`[Medical] Centers with address: ${centersWithAddressResult.total}`);
      
      // بررسی نمونه مراکزی که address دارند
      const sampleWithAddressQuery = `SELECT id, name, province, city, address FROM centers WHERE address IS NOT NULL AND address != '' LIMIT 5`;
      const sampleWithAddressRows = await db.all(sampleWithAddressQuery);
      console.log(`[Medical] Sample centers with address (${sampleWithAddressRows.length}):`, JSON.stringify(sampleWithAddressRows, null, 2));
      
      const centersQuery = `SELECT DISTINCT province FROM centers WHERE isActive = 1 AND province IS NOT NULL AND province != '' ORDER BY province ASC`;
      const centersRows = await db.all(centersQuery);
      console.log(`[Medical] Centers query result (${centersRows.length} rows):`, centersRows);
      
      let provinces = centersRows.map(row => row.province).filter(Boolean);
      console.log(`[Medical] Provinces from centers (${provinces.length}):`, provinces);
      
      // اگر province پیدا نشد، از city استفاده کنیم
      if (provinces.length === 0) {
        console.log('[Medical] No provinces found, trying to use city as province...');
        const cityQuery = `SELECT DISTINCT city FROM centers WHERE isActive = 1 AND city IS NOT NULL AND city != '' ORDER BY city ASC`;
        const cityRows = await db.all(cityQuery);
        console.log(`[Medical] Cities found (${cityRows.length}):`, cityRows.map(r => r.city));
        
        // استفاده از city به عنوان province
        provinces = cityRows.map(row => row.city).filter(Boolean);
        console.log(`[Medical] Using cities as provinces (${provinces.length}):`, provinces);
      }
      
      // همچنین از center_addresses
      console.log('[Medical] Trying query from center_addresses table...');
      
      // ابتدا بررسی کنیم که آیا جدول center_addresses وجود دارد
      const addressTableCheck = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='center_addresses'`);
      console.log(`[Medical] center_addresses table exists: ${!!addressTableCheck}`);
      
      if (addressTableCheck) {
        // بررسی تعداد آدرس‌ها
        const addressCountQuery = `SELECT COUNT(*) as total FROM center_addresses`;
        const addressCountResult = await db.get(addressCountQuery);
        console.log(`[Medical] Total addresses in center_addresses: ${addressCountResult.total}`);
        
        // بررسی نمونه آدرس‌ها
        const addressSampleQuery = `SELECT id, centerId, province, city FROM center_addresses LIMIT 5`;
        const addressSampleRows = await db.all(addressSampleQuery);
        console.log(`[Medical] Sample addresses (${addressSampleRows.length}):`, JSON.stringify(addressSampleRows, null, 2));
      }
      
      const addressQuery = `SELECT DISTINCT province FROM center_addresses WHERE province IS NOT NULL AND province != '' ORDER BY province ASC`;
      const addressRows = await db.all(addressQuery);
      console.log(`[Medical] Address query result (${addressRows.length} rows):`, addressRows);
      
      const addressProvinces = addressRows.map(row => row.province).filter(Boolean);
      console.log(`[Medical] Provinces from addresses (${addressProvinces.length}):`, addressProvinces);
      
      // ترکیب و حذف تکراری‌ها
      provinces = [...new Set([...provinces, ...addressProvinces])].sort();
      console.log(`[Medical] Final unique provinces (${provinces.length}):`, provinces);
      
      if (provinces.length === 0) {
        // اگر هنوز خالی است، یک query بدون فیلتر امتحان کنیم
        console.log('[Medical] Trying query without filters...');
        const allCentersQuery = `SELECT DISTINCT province FROM centers WHERE province IS NOT NULL ORDER BY province ASC`;
        const allCentersRows = await db.all(allCentersQuery);
        console.log(`[Medical] All centers query result (${allCentersRows.length} rows):`, allCentersRows);
        
        const allProvinces = allCentersRows.map(row => row.province).filter(Boolean);
        if (allProvinces.length > 0) {
          provinces = allProvinces;
          console.log(`[Medical] Using all provinces (${provinces.length}):`, provinces);
        } else {
          // بررسی اینکه آیا اصلاً مراکزی در دیتابیس وجود دارد
          console.log('[Medical] Checking if centers table has any data...');
          const countQuery = `SELECT COUNT(*) as total FROM centers`;
          const countResult = await db.get(countQuery);
          console.log(`[Medical] Total centers in database: ${countResult.total}`);
          
          // بررسی نمونه مراکز
          const sampleQuery = `SELECT id, name, province, city, isActive FROM centers LIMIT 5`;
          const sampleRows = await db.all(sampleQuery);
          console.log(`[Medical] Sample centers (${sampleRows.length}):`, sampleRows);
          
          // بررسی اینکه آیا فیلد province در جدول وجود دارد
          const tableInfoQuery = `PRAGMA table_info(centers)`;
          const tableInfo = await db.all(tableInfoQuery);
          const hasProvinceColumn = tableInfo.some(col => col.name === 'province');
          console.log(`[Medical] Has province column: ${hasProvinceColumn}`);
          console.log(`[Medical] Table columns:`, tableInfo.map(col => col.name));
        }
      }
      
      if (provinces.length === 0) {
        console.log('[Medical] No provinces found, sending error message');
        await this.bot.sendMessage(chatId,
          '❌ هیچ استانی در سیستم ثبت نشده است.',
          this.buildMedicalCenterFilterKeyboard()
        );
        return;
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: []
        }
      };

      // استفاده از short IDs برای استان‌ها (مثل brands و products)
      // Mapping از short ID به نام کامل استان
      const provinceShortIds = {
        'az_sh': 'آذربایجان شرقی',
        'az_gh': 'آذربایجان غربی',
        'ard': 'اردبیل',
        'esf': 'اصفهان',
        'alb': 'البرز',
        'ilam': 'ایلام',
        'bush': 'بوشهر',
        'teh': 'تهران',
        'khor_j': 'خراسان جنوبی',
        'khor_r': 'خراسان رضوی',
        'khor_sh': 'خراسان شمالی',
        'khoz': 'خوزستان',
        'zan': 'زنجان',
        'semn': 'سمنان',
        'sist': 'سیستان و بلوچستان',
        'fars': 'فارس',
        'qaz': 'قزوین',
        'qom': 'قم',
        'lor': 'لرستان',
        'maz': 'مازندران',
        'mark': 'مرکزی',
        'horm': 'هرمزگان',
        'ham': 'همدان',
        'chah': 'چهارمحال و بختیاری',
        'kord': 'کردستان',
        'kerm': 'کرمان',
        'kerm_sh': 'کرمانشاه',
        'koh': 'کهگیلویه و بویراحمد',
        'gol': 'گلستان',
        'gil': 'گیلان',
        'yaz': 'یزد'
      };
      
      // ایجاد reverse mapping از نام استان به short ID
      const provinceToShortId = {};
      Object.entries(provinceShortIds).forEach(([shortId, fullName]) => {
        provinceToShortId[fullName] = shortId;
      });
      
      // استفاده از short IDs برای callback_data
      const buttons = provinces.map(province => {
        const shortId = provinceToShortId[province] || province.substring(0, 10); // fallback
        return [
          { text: province, callback_data: `medical_center_province_${shortId}` }
        ];
      });

      buttons.push([{ text: '🔙 بازگشت', callback_data: 'medical_center_show_all' }]);
      keyboard.reply_markup.inline_keyboard = buttons;

      await this.bot.sendMessage(chatId,
        '📍 *استان را برای فیلتر انتخاب کنید:*',
        { ...keyboard, parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[Medical] province filter error:', error);
      await this.bot.sendMessage(chatId,
        '⚠️ دریافت لیست استان‌ها با خطا مواجه شد.',
        this.buildMedicalCenterFilterKeyboard()
      );
    }
  }

  async handleMedicalCenterProvinceSelected(chatId, province) {
    console.log(`[Medical] handleMedicalCenterProvinceSelected called for province: ${province}`);
    let conversation = this.conversations.get(chatId);
    
    // اگر conversation وجود ندارد، آن را ایجاد کنیم
    if (!conversation) {
      console.log(`[Medical] No conversation found, creating new one`);
      conversation = {
        step: 'medical_upload_center',
        data: {}
      };
      this.conversations.set(chatId, conversation);
    }
    
    // پذیرش هم medical_upload_center و هم بعد از فیلتر استان
    if (conversation.step !== 'medical_upload_center' && conversation.step !== 'medical_center_filter_province') {
      console.log(`[Medical] Invalid conversation step: ${conversation.step}, setting to medical_upload_center`);
      conversation.step = 'medical_upload_center';
      this.conversations.set(chatId, conversation);
    }

    console.log(`[Medical] Showing centers filtered by province: ${province}`);
    console.log(`[Medical] Province length: ${province.length}, Province bytes: ${Buffer.from(province, 'utf8').length}`);
    console.log(`[Medical] Province trimmed: "${province.trim()}"`);
    
    // نمایش مراکز فیلتر شده بر اساس استان
    // چون استان‌ها در فیلد city هستند، از city استفاده می‌کنیم
    // اما باید مطمئن شویم که نام استان دقیقاً مطابقت دارد
    // trim کردن space ها و استفاده از نام کامل استان
    // reset صفحه به 0
    const trimmedProvince = province.trim();
    await this.promptMedicalCenter(chatId, { city: trimmedProvince }, 0);
  }

  // ========== فیلتر مرکز - کارشناس ==========
  async handleMedicalCenterFilterPersonnel(chatId) {
    try {
      const personnelList = await Personnel.getAll();
      const activePersonnel = personnelList.filter(p => p.isActive !== false);
      
      if (activePersonnel.length === 0) {
        await this.bot.sendMessage(chatId,
          '❌ هیچ کارشناسی در سیستم ثبت نشده است.',
          this.buildMedicalCenterFilterKeyboard()
        );
        return;
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: []
        }
      };

      // نمایش حداکثر 20 کارشناس
      const buttons = activePersonnel.slice(0, 20).map(personnel => ([
        { text: `${personnel.name}${personnel.phone ? ` (${personnel.phone})` : ''}`, callback_data: `medical_center_personnel_${personnel.id}` }
      ]));

      buttons.push([{ text: '🔙 بازگشت', callback_data: 'medical_center_show_all' }]);
      keyboard.reply_markup.inline_keyboard = buttons;

      await this.bot.sendMessage(chatId,
        '👤 *کارشناس را برای فیلتر انتخاب کنید:*',
        { ...keyboard, parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[Medical] personnel filter error:', error);
      await this.bot.sendMessage(chatId,
        '⚠️ دریافت لیست کارشناسان با خطا مواجه شد.',
        this.buildMedicalCenterFilterKeyboard()
      );
    }
  }

  async handleMedicalCenterPersonnelSelected(chatId, personnelId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_center') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // نمایش مراکز فیلتر شده بر اساس کارشناس مسئول و reset صفحه به 0
    await this.promptMedicalCenter(chatId, { responsiblePersonnelId: personnelId }, 0);
  }

  // ========== جستجوی مرکز ==========
  async handleMedicalCenterSearch(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_center') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.step = 'medical_center_search';
    this.conversations.set(chatId, conversation);

    await this.bot.sendMessage(chatId,
      '🔍 *نام مرکز را برای جستجو وارد کنید:*\n\n(یا "لغو" برای بازگشت)',
      { ...this.buildMedicalUploadCancelKeyboard(), parse_mode: 'Markdown' }
    );
  }

  // دسته‌بندی
  async promptMedicalCategory(chatId, conversation) {
    // استفاده از ID کوتاه برای جلوگیری از خطای BUTTON_DATA_INVALID
    const categories = [
      { id: 'sample', name: 'درخواست نمونه' },
      { id: 'approval', name: 'تایید برند' }
    ];
    const keyboard = {
      reply_markup: {
        inline_keyboard: categories.map(category => ([
          { text: category.name, callback_data: `medical_category_${category.id}` }
        ])).concat([[{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]])
      }
    };

    await this.bot.sendMessage(chatId,
      '📁 *دسته‌بندی تاییدیه را انتخاب کنید:*',
      { ...keyboard, parse_mode: 'Markdown' }
    );
  }

  async handleMedicalCategorySelection(chatId, categoryId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_category') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // تبدیل ID به نام کامل دسته‌بندی
    const categoryMap = {
      'sample': 'درخواست نمونه',
      'approval': 'تایید برند'
    };

    const category = categoryMap[categoryId] || categoryId;

    conversation.data = conversation.data || {};
    conversation.data.category = category;
    await this.finalizeMedicalUpload(chatId, conversation);
  }

  async finalizeMedicalUpload(chatId, conversation) {
    const data = conversation.data || {};

    if (!data.fileBuffer || !data.fileName) {
      await this.bot.sendMessage(chatId, '❌ فایل به درستی دریافت نشد. لطفاً دوباره تلاش کنید.');
      this.conversations.delete(chatId);
      return;
    }

    if (!data.brand || !data.product || !data.centerId || !data.doctorName || !data.doctorSpecialty || !data.province || !data.category) {
      await this.bot.sendMessage(chatId, '❌ اطلاعات ناقص است. لطفاً تمام فیلدهای اجباری را پر کنید.');
      return;
    }

    try {
      const result = await HrApi.uploadMedicalFile({
        fileBuffer: data.fileBuffer,
        filename: data.fileName,
        mimeType: data.mimeType,
        brand: data.brand,
        product: data.product,
        centerId: data.centerId,
        doctorName: data.doctorName,
        doctorSpecialty: data.doctorSpecialty,
        province: data.province,
        category: data.category,
        description: data.description,
        uploadedBy: conversation.telegramId
      });

      this.conversations.delete(chatId);

      const center = await Center.getById(data.centerId);
      
      // Escape Markdown special characters
      const escapeMarkdown = (text) => {
        if (!text) return 'نامشخص';
        return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      };
      
      await this.bot.sendMessage(chatId,
        `✅ *فایل تاییدیه با موفقیت ذخیره شد\\!*\n\n` +
        `🆔 شناسه: ${result.id}\n` +
        `📄 نام فایل: ${escapeMarkdown(result.original_name)}\n` +
        `🏷️ برند: ${escapeMarkdown(result.brand)}\n` +
        `📦 کالا: ${escapeMarkdown(result.product)}\n` +
        `🏥 مرکز: ${escapeMarkdown(center?.name)}\n` +
        `👨‍⚕️ پزشک: ${escapeMarkdown(result.doctor_name)}\n` +
        `🏥 تخصص: ${escapeMarkdown(result.doctor_specialty)}\n` +
        `📍 استان: ${escapeMarkdown(result.province)}\n` +
        `📁 دسته‌بندی: ${escapeMarkdown(result.category)}`,
        { ...this.buildHrMenuKeyboard(), parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[Medical] upload error:', error);
      await this.bot.sendMessage(chatId, `❌ بارگذاری فایل با خطا مواجه شد: ${error.message}`);
    }
  }

  async cancelMedicalUpload(chatId, message) {
    const conversation = this.conversations.get(chatId);
    if (conversation && conversation.step && conversation.step.startsWith('medical_upload_')) {
      this.conversations.delete(chatId);
    }
    await this.bot.sendMessage(chatId, message || '❌ آپلود لغو شد.', this.buildHrMenuKeyboard());
  }

  // تایید نام پزشک
  async handleMedicalDoctorConfirm(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_doctor_name_confirm') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // نام پزشک قبلاً در data.doctorName ست شده
    const aiExtracted = conversation.data?.aiExtracted || {};
    if (aiExtracted.specialty) {
      conversation.data.doctorSpecialty = aiExtracted.specialty;
      conversation.step = 'medical_upload_doctor_specialty_confirm';
      this.conversations.set(chatId, conversation);
      
      await this.bot.sendMessage(chatId,
        `🩺 *تخصص پزشک:*\n\n` +
        `✅ تخصص تشخیص داده‌شده: ${aiExtracted.specialty}\n\n` +
        `این تخصص را تایید می‌کنید؟`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ تایید', callback_data: 'medical_specialty_confirm' }],
              [{ text: '✏️ ویرایش', callback_data: 'medical_specialty_edit' }],
              [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
            ]
          },
          parse_mode: 'Markdown'
        }
      );
      return;
    }

    conversation.step = 'medical_upload_doctor_specialty';
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId,
      '🏥 تخصص پزشک را وارد کنید:',
      this.buildMedicalUploadCancelKeyboard()
    );
  }

  async handleMedicalDoctorEdit(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.step = 'medical_upload_doctor_name';
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId,
      '👨‍⚕️ *نام پزشک را وارد کنید:*',
      { ...this.buildMedicalUploadCancelKeyboard(), parse_mode: 'Markdown' }
    );
  }

  // تایید تخصص پزشک
  async handleMedicalSpecialtyConfirm(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_doctor_specialty_confirm') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // تخصص قبلاً در data.doctorSpecialty ست شده
    const aiExtracted = conversation.data?.aiExtracted || {};
    if (aiExtracted.province) {
      conversation.data.province = aiExtracted.province;
      conversation.step = 'medical_upload_province_confirm';
      this.conversations.set(chatId, conversation);
      
      await this.bot.sendMessage(chatId,
        `📍 *استان:*\n\n` +
        `✅ استان تشخیص داده‌شده: ${aiExtracted.province}\n\n` +
        `این استان را تایید می‌کنید؟`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ تایید', callback_data: 'medical_province_confirm' }],
              [{ text: '✏️ انتخاب استان دیگر', callback_data: 'medical_province_edit' }],
              [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
            ]
          },
          parse_mode: 'Markdown'
        }
      );
      return;
    }

    conversation.step = 'medical_upload_province';
    this.conversations.set(chatId, conversation);
    await this.promptMedicalProvince(chatId);
  }

  async handleMedicalSpecialtyEdit(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.step = 'medical_upload_doctor_specialty';
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId,
      '🏥 تخصص پزشک را وارد کنید:',
      this.buildMedicalUploadCancelKeyboard()
    );
  }

  // تایید استان
  async handleMedicalProvinceConfirm(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_province_confirm') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // استان قبلاً در data.province ست شده
    const aiExtracted = conversation.data?.aiExtracted || {};
    if (aiExtracted.description) {
      conversation.data.description = aiExtracted.description;
      conversation.step = 'medical_upload_description_confirm';
      this.conversations.set(chatId, conversation);
      
      await this.bot.sendMessage(chatId,
        `📝 *توضیحات:*\n\n` +
        `✅ توضیحات تشخیص داده‌شده:\n${aiExtracted.description}\n\n` +
        `این توضیحات را تایید می‌کنید؟`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ تایید', callback_data: 'medical_description_confirm' }],
              [{ text: '✏️ ویرایش', callback_data: 'medical_description_edit' }],
              [{ text: '⏭️ بدون توضیحات', callback_data: 'medical_description_skip' }],
              [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
            ]
          },
          parse_mode: 'Markdown'
        }
      );
      return;
    }

    conversation.step = 'medical_upload_description';
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId,
      '📝 *توضیحات اضافی را وارد کنید:*',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ رد کردن', callback_data: 'medical_description_skip' }],
            [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }

  async handleMedicalProvinceEditRequest(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.step = 'medical_upload_province';
    this.conversations.set(chatId, conversation);
    await this.promptMedicalProvince(chatId);
  }

  // تایید توضیحات
  async handleMedicalDescriptionConfirm(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'medical_upload_description_confirm') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    // توضیحات قبلاً در data.description ست شده
    conversation.step = 'medical_upload_category';
    this.conversations.set(chatId, conversation);
    await this.promptMedicalCategory(chatId, conversation);
  }

  async handleMedicalDescriptionEdit(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.step = 'medical_upload_description';
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId,
      '📝 *توضیحات اضافی را وارد کنید:*',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ رد کردن', callback_data: 'medical_description_skip' }],
            [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
          ]
        },
        parse_mode: 'Markdown'
      }
    );
  }

  async handleMedicalDescriptionSkip(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است.');
      return;
    }

    conversation.data = conversation.data || {};
    conversation.data.description = null;
    conversation.step = 'medical_upload_category';
    this.conversations.set(chatId, conversation);
    await this.promptMedicalCategory(chatId, conversation);
  }

  async startAiMultiContactFlow(chatId, centers = [], context = {}, fields = {}, originalInput = '') {
    if (!centers.length) {
      await this.bot.sendMessage(chatId, '⚠️ نام مراکز برای ثبت تماس مشخص نیست.');
      return;
    }

    const flowData = {
      pendingCenters: [...centers],
      completed: [],
      context,
      baseFields: this.cloneSimpleObject(fields),
      originalInput,
      defaultContactType: this.normalizeContactTypeValue(fields.contactType) || 'phone',
      notes: this.buildContactNotes(fields, originalInput) || originalInput || null,
      personnel: context.personnel || null,
      telegramId: context.telegramId || context.personnel?.telegramId || null,
      total: centers.length,
      currentCenter: null
    };

    this.conversations.set(chatId, {
      type: 'ai_contact_multi',
      createdAt: Date.now(),
      data: flowData
    });

    await this.bot.sendMessage(chatId,
      `📞 ثبت ${centers.length} تماس تلفنی آغاز شد.\n` +
      `هر تماس پس از انتخاب مرکز به صورت خودکار ثبت می‌شود.`
    );
    await this.processNextMultiContact(chatId);
  }

  async processNextMultiContact(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.type !== 'ai_contact_multi') {
      return;
    }

    const data = conversation.data || {};
    if (!Array.isArray(data.pendingCenters)) {
      this.conversations.delete(chatId);
      return;
    }

    if (!data.pendingCenters.length) {
      this.conversations.delete(chatId);
      const count = data.completed?.length || 0;
      const summary = count
        ? '✅ همه تماس‌ها با موفقیت ثبت شدند.'
        : '⚠️ هیچ تماسی ثبت نشد.';
      await this.bot.sendMessage(chatId, summary);
      return;
    }

    const nextCenter = (data.pendingCenters.shift() || '').trim();
    if (!nextCenter) {
      await this.processNextMultiContact(chatId);
      return;
    }

    data.currentCenter = nextCenter;
    this.conversations.set(chatId, conversation);

    const remaining = data.pendingCenters.length;
    const index = (data.completed?.length || 0) + 1;
    await this.bot.sendMessage(chatId,
      `📍 تماس ${index} از ${data.total}: «${nextCenter}»\n` +
      `لطفاً مرکز دقیق را از لیست انتخاب کنید یا نام دقیق‌تر را بنویسید.`
    );

    await this.promptAiCenterSelection(chatId, {
      intent: 'create_contact_multi',
      fields: {
        ...data.baseFields,
        centerName: nextCenter,
        notes: data.notes,
        contactType: data.defaultContactType
      },
      context: data.context,
      originalInput: data.originalInput,
      multiContext: {
        type: 'ai_contact_multi',
        flowData: data,
        index
      }
    });
  }

  async handleMultiContactAfterSelection(chatId, multiContext, actionResult) {
    const flowData = multiContext?.flowData;
    if (!flowData) {
      await this.bot.sendMessage(chatId, '⚠️ خطا در ادامه ثبت تماس‌های چندگانه. لطفاً دوباره تلاش کنید.');
      return;
    }

    const completedList = flowData.completed || (flowData.completed = []);
    completedList.push({
      centerName: flowData.currentCenter,
      actionResult
    });
    flowData.currentCenter = null;

    this.conversations.set(chatId, {
      type: 'ai_contact_multi',
      createdAt: Date.now(),
      data: flowData
    });

    await this.processNextMultiContact(chatId);
  }

  buildMedicalUploadCancelKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ لغو', callback_data: 'medical_upload_cancel' }]
        ]
      }
    };
  }

  async extractTelegramFile(msg) {
    const document = msg.document;
    const photos = msg.photo;

    let fileId;
    let fileName;
    let mimeType;

    if (document) {
      fileId = document.file_id;
      fileName = document.file_name || `file_${document.file_unique_id}`;
      mimeType = document.mime_type || 'application/octet-stream';
    } else if (photos && photos.length) {
      const bestPhoto = photos[photos.length - 1];
      fileId = bestPhoto.file_id;
      fileName = `photo_${bestPhoto.file_unique_id}.jpg`;
      mimeType = 'image/jpeg';
    } else {
      return null;
    }

    const buffer = await this.downloadTelegramFile(fileId);
    if (!buffer) {
      return null;
    }

    return {
      fileBuffer: buffer,
      fileName,
      mimeType
    };
  }

  async downloadTelegramFile(fileId) {
    try {
      const fileLink = await this.bot.getFileLink(fileId);
      const axios = (await import('axios')).default;
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('[Telegram] download file error:', error);
      return null;
    }
  }

  async startHrLeaveConversation(chatId, telegramId) {
    const ctx = await this.prepareHrContext(telegramId, chatId);
    if (!ctx) return;

    this.conversations.set(chatId, {
      step: 'hr_leave_type',
      telegramId,
      data: {
        employeeId: ctx.employee.id,
        remainingDays: ctx.employee.remaining_leave_days ?? ctx.employee.remainingLeaveDays ?? ctx.employee.total_leave_days
      }
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📅 سالانه', callback_data: 'hr_leave_type_annual' },
            { text: '🏥 استعلاجی', callback_data: 'hr_leave_type_sick' }
          ],
          [
            { text: '🚨 فوری', callback_data: 'hr_leave_type_emergency' },
            { text: '⏰ ساعتی', callback_data: 'hr_leave_type_hourly' }
          ],
          [
            { text: '❌ لغو', callback_data: 'hr_leave_cancel' }
          ]
        ]
      },
      parse_mode: 'Markdown'
    };

    await this.bot.sendMessage(chatId,
      '📝 *ثبت مرخصی جدید*\n\nابتدا نوع مرخصی را انتخاب کنید:',
      keyboard
    );
  }

  async handleHrLeaveTypeSelection(chatId, telegramId, leaveType) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.step !== 'hr_leave_type') {
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است. دوباره روی "مرخصی جدید" بزنید.');
      return;
    }

    conversation.data = conversation.data || {};
    conversation.data.leaveType = leaveType;

    if (leaveType === 'hourly') {
      conversation.step = 'hr_leave_hourly_date';
      this.conversations.set(chatId, conversation);
      await this.promptDateSelection(chatId, conversation, {
        pickerId: 'hr_leave_hourly_date',
        title: '📅 تاریخ مرخصی ساعتی را انتخاب کنید:',
        cancelCallback: 'hr_leave_cancel'
      });
      return;
    }

    conversation.step = 'hr_leave_start_date';
    this.conversations.set(chatId, conversation);
    await this.promptDateSelection(chatId, conversation, {
      pickerId: 'hr_leave_start_date',
      title: '📅 تاریخ شروع مرخصی را انتخاب کنید:',
      cancelCallback: 'hr_leave_cancel'
    });
  }

  buildHrMenuKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 مرخصی جدید', callback_data: 'hr_leave_new' },
            { text: '📄 وضعیت مرخصی', callback_data: 'hr_leave_status' }
          ],
          [
            { text: '🕘 ثبت ورود', callback_data: 'hr_attendance_checkin' },
            { text: '🕔 ثبت خروج', callback_data: 'hr_attendance_checkout' }
          ],
          [
            { text: '📅 گزارش حضور', callback_data: 'hr_attendance_history' },
            { text: '💰 حقوق / فیش', callback_data: 'hr_payroll_overview' }
          ],
          [
            { text: '🏥 تاییدیه‌ها', callback_data: 'hr_medical_menu' },
            { text: '🏠 بازگشت', callback_data: 'menu_back_to_main' }
          ]
        ]
      },
      parse_mode: 'Markdown'
    };
  }

  async prepareHrContext(telegramId, chatId) {
    const personnel = await Personnel.getByTelegramId(telegramId);
    if (!personnel) {
      console.error(`[prepareHrContext] Personnel not found for telegramId: ${telegramId}`);
      await this.bot.sendMessage(chatId, '❌ شما در سیستم ماموریت ثبت نشده‌اید.');
      return null;
    }

    // بررسی سلامت HR backend قبل از فراخوانی (غیرفعال برای تست سریع‌تر)
    // const isHrBackendHealthy = await HrApi.checkHrBackendHealth();
    // if (!isHrBackendHealthy) {
    //   console.error(`[prepareHrContext] HR backend is not accessible`);
    //   await this.bot.sendMessage(chatId, 
    //     '❌ سرویس منابع انسانی در دسترس نیست.\n\n' +
    //     'لطفاً با مدیر سیستم تماس بگیرید تا سرویس را راه‌اندازی کند.'
    //   );
    //   return null;
    // }

    const employee = await this.ensureHrEmployee(personnel, telegramId);
    if (!employee) {
      console.error(`[prepareHrContext] Failed to ensure HR employee for telegramId: ${telegramId}`);
      await this.bot.sendMessage(chatId, 
        '❌ خطا در اتصال به ماژول HR.\n\n' +
        'لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.'
      );
      return null;
    }

    return { personnel, employee };
  }

  async ensureHrEmployee(personnel, telegramId) {
    try {
      const sanitizedName = (personnel.name || '').trim() || 'کاربر CRM';
      const [firstName, ...rest] = sanitizedName.split(/\s+/);
      const lastName = rest.join(' ');
      
      console.log(`[HR] Ensuring employee for telegramId: ${telegramId}, name: ${firstName} ${lastName}`);
      
      const employee = await HrApi.ensureEmployee({
        telegramId: Number(telegramId),
        firstName: firstName || 'کاربر',
        lastName,
        phone: personnel.phone || undefined
      });
      
      if (!employee || !employee.id) {
        console.error('[HR] ensureEmployee returned invalid response:', employee);
        return null;
      }
      
      console.log(`[HR] Employee ensured successfully:`, { id: employee?.id, telegramId: employee?.telegram_id });
      return employee;
    } catch (error) {
      const errorDetails = {
        message: error.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        code: error?.code,
        url: error?.config?.url
      };
      
      console.error('[HR] ensureEmployee error:', errorDetails);
      
      // اگر خطای connection است، پیام واضح‌تری به کاربر بده
      if (error?.message?.includes('در دسترس نیست') || error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') {
        console.error('[HR] HR backend is not accessible:', error?.code);
      }
      
      return null;
    }
  }

  async sendHrLeaveStatus(chatId, telegramId) {
    const ctx = await this.prepareHrContext(telegramId, chatId);
    if (!ctx) return;

    try {
      const role = (ctx.personnel.role || '').toLowerCase();
      const isManager = ['admin', 'manager', 'super_admin', 'owner'].includes(role);
      if (isManager) {
        const pending = await HrApi.listLeaveRequests({
          status: 'pending',
          limit: 10
        });

        if (!pending.length) {
          await this.bot.sendMessage(chatId, '✅ هیچ درخواست در انتظار تاییدی وجود ندارد.', this.buildHrMenuKeyboard());
          return;
        }

        await this.bot.sendMessage(chatId, `📋 *درخواست‌های در انتظار تایید (${pending.length})*`, {
          ...this.buildHrMenuKeyboard(),
          parse_mode: 'Markdown'
        });

        for (const req of pending) {
          const amount = req.hours_count
            ? `${this.formatHrNumber(req.hours_count)} ساعت`
            : `${this.formatHrNumber(req.days_count)} روز`;
          const employeeName = req.employee_name || req.employee_full_name || `کارمند #${req.employee_id}`;
          const startLabel = req.start_date ? this.formatPersianDate(req.start_date) : this.formatPersianDate(req.created_at);
          const endLabel = req.end_date ? this.formatPersianDate(req.end_date) : startLabel;
          
          // برای مرخصی ساعتی، ساعت شروع و پایان را اضافه کن
          let timeInfo = '';
          if (req.leave_type === 'hourly' && req.start_time && req.end_time) {
            // فرمت زمان را به HH:mm تبدیل کن (اگر به صورت HH:mm:ss است)
            const formatTime = (timeStr) => {
              if (!timeStr) return '';
              // اگر به صورت HH:mm:ss است، فقط HH:mm را بگیر
              if (timeStr.includes(':')) {
                const parts = timeStr.split(':');
                return `${parts[0]}:${parts[1]}`;
              }
              return timeStr;
            };
            const startTime = formatTime(req.start_time);
            const endTime = formatTime(req.end_time);
            timeInfo = `\n⏰ ساعت: ${startTime} ⬅️ ${endTime}`;
          }
          
          const lines = [
            `🆔 ${req.id} | ${employeeName}`,
            `📅 ${startLabel} ⬅️ ${endLabel}${timeInfo}`,
            `📊 ${amount} | نوع: ${this.mapLeaveTypeLabel(req.leave_type)}`,
            req.reason ? `💬 دلیل: ${req.reason}` : ''
          ].filter(Boolean).join('\n');

          const keyboard = {
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ تایید', callback_data: `hr_leave_mgr_approve_${req.id}` },
                { text: '❌ رد', callback_data: `hr_leave_mgr_reject_${req.id}` }
              ]]
            },
            parse_mode: 'Markdown'
          };

          await this.bot.sendMessage(chatId, lines, keyboard);
        }
        return;
      }

      const requests = await HrApi.listLeaveRequests({
        employeeId: ctx.employee.id,
        limit: 5
      });

      if (!requests.length) {
        await this.bot.sendMessage(chatId, '📄 هیچ درخواست مرخصی ثبت نشده است.', this.buildHrMenuKeyboard());
        return;
      }

      const lines = requests.map((req, idx) => {
        const start = req.start_date || req.created_at;
        const end = req.end_date || start;
        const startLabel = this.formatPersianDate(start);
        const endLabel = this.formatPersianDate(end);
        const status = this.mapHrStatus(req.status);
        const amount = req.hours_count
          ? `${this.formatHrNumber(req.hours_count)} ساعت`
          : `${this.formatHrNumber(req.days_count)} روز`;
        return `${idx + 1}. ${status}\n   ${startLabel} ➡️ ${endLabel} (${amount})`;
      });

      const keyboard = this.buildHrMenuKeyboard();
      const pendingRequests = requests.filter((req) => req.status === 'pending');
      if (pendingRequests.length) {
        const cancelButtons = pendingRequests.map((req) => ([
          {
            text: `❌ لغو ${req.id}`,
            callback_data: `hr_leave_cancel_request_${req.id}`
          }
        ]));
        keyboard.reply_markup.inline_keyboard = cancelButtons.concat(keyboard.reply_markup.inline_keyboard);
      }

      await this.bot.sendMessage(chatId, `📄 *آخرین درخواست‌ها*\n\n${lines.join('\n\n')}`, {
        ...keyboard,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[HR] leave status error:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در دریافت وضعیت مرخصی: ${error.message}`);
    }
  }

  mapHrStatus(status) {
    const map = {
      pending: '⏳ در انتظار',
      approved: '✅ تایید شده',
      rejected: '❌ رد شده'
    };
    return map[status] || status || 'نامشخص';
  }

  async handleHrAttendanceAction(chatId, telegramId, action) {
    const ctx = await this.prepareHrContext(telegramId, chatId);
    if (!ctx) return;

    const today = new Date();
    const dateStr = this.formatDate(today);
    const timeStr = this.formatTime(today);

    try {
      const records = await HrApi.listAttendances({
        employeeId: ctx.employee.id,
        startDate: dateStr,
        endDate: dateStr,
        limit: 1
      });

      const record = records[0];
      if (action === 'checkin') {
        if (record && record.check_in_time) {
          await this.bot.sendMessage(chatId, `✅ ورود امروز قبلاً با ساعت ${record.check_in_time} ثبت شده است.`);
          return;
        }
        if (record) {
          await HrApi.updateAttendance(record.id, { check_in_time: timeStr, is_present: true });
        } else {
          await HrApi.createAttendance({
            employee_id: ctx.employee.id,
            date: dateStr,
            check_in_time: timeStr,
            is_present: true
          });
        }
        await this.bot.sendMessage(chatId, `✅ ورود امروز با ساعت ${timeStr} ثبت شد.`);
      } else {
        if (!record) {
          await HrApi.createAttendance({
            employee_id: ctx.employee.id,
            date: dateStr,
            check_out_time: timeStr,
            is_present: true
          });
        } else if (record.check_out_time) {
          await this.bot.sendMessage(chatId, `ℹ️ خروج امروز قبلاً با ساعت ${record.check_out_time} ذخیره شده است.`);
          return;
        } else {
          await HrApi.updateAttendance(record.id, { check_out_time: timeStr });
        }
        await this.bot.sendMessage(chatId, `✅ خروج امروز با ساعت ${timeStr} ثبت شد.`);
      }
    } catch (error) {
      console.error('[HR] attendance error:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در ثبت حضور/خروج: ${error.message}`);
    }
  }

  async showHrAttendanceHistory(chatId, telegramId) {
    const ctx = await this.prepareHrContext(telegramId, chatId);
    if (!ctx) return;

    try {
      const records = await HrApi.listAttendances({
        employeeId: ctx.employee.id,
        limit: 7
      });

      if (!records.length) {
        await this.bot.sendMessage(chatId, '📅 سابقه حضوری یافت نشد.', this.buildHrMenuKeyboard());
        return;
      }

      const lines = records.map(record => {
        const persianDate = this.formatPersianDate(record.date);
        const checkIn = record.check_in_time || '-';
        const checkOut = record.check_out_time || '-';
        const hours = this.formatHrNumber(record.work_hours || 0);
        return `${persianDate} | ورود: ${checkIn} | خروج: ${checkOut} | ${hours} ساعت`;
      });

      await this.bot.sendMessage(chatId, `📅 *آخرین حضورها*\n\n${lines.join('\n')}`, {
        ...this.buildHrMenuKeyboard(),
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[HR] attendance history error:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در دریافت گزارش حضور: ${error.message}`);
    }
  }

  async showHrPayroll(chatId, telegramId) {
    const ctx = await this.prepareHrContext(telegramId, chatId);
    if (!ctx) return;

    try {
      const salaries = await HrApi.listSalaries({
        employeeId: ctx.employee.id,
        limit: 3
      });

      if (!salaries.length) {
        await this.bot.sendMessage(chatId, '💰 رکورد حقوقی ثبت نشده است.', this.buildHrMenuKeyboard());
        return;
      }

      const lines = salaries.map(salary => {
        const paid = salary.is_paid ? '✅' : '⏳';
        const month = `${salary.year}/${String(salary.month).padStart(2, '0')}`;
        return `${paid} ${month} - ${this.formatCurrencyValue(salary.total_salary)} تومان`;
      });

      await this.bot.sendMessage(chatId, `💰 *آخرین فیش‌ها*\n\n${lines.join('\n')}`, {
        ...this.buildHrMenuKeyboard(),
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[HR] payroll error:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در دریافت اطلاعات حقوق: ${error.message}`);
    }
  }

  async showMedicalMenu(chatId, telegramId = null) {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📄 لیست تاییدیه‌ها', callback_data: 'medical_list' },
            { text: '🔍 جستجوی تاییدیه', callback_data: 'medical_search_start' }
          ],
          [
            { text: '📁 دسته‌بندی‌ها', callback_data: 'medical_categories' },
            { text: '📤 آپلود تاییدیه', callback_data: 'medical_upload_start' }
          ],
          [
            { text: '🏠 بازگشت', callback_data: 'menu_back_to_main' }
          ]
        ]
      }
    };

    await this.bot.sendMessage(chatId, '🏥 *مدیریت تاییدیه‌های پزشکی*\n\nگزینه مورد نظر را انتخاب کنید.', {
      ...keyboard,
      parse_mode: 'Markdown'
    });
  }

  async showMedicalFiles(chatId, filters = {}, page = 0) {
    try {
      const limit = 10;
      const skip = page * limit;
      
      console.log('[Medical] Fetching files with filters:', { ...filters, limit, skip });
      const response = await HrApi.listMedicalFiles({ 
        ...filters,
        limit,
        skip
      });
      
      // Handle different response formats
      let files = [];
      if (Array.isArray(response)) {
        files = response;
      } else if (response && Array.isArray(response.data)) {
        files = response.data;
      } else if (response && response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        // If it's an object with items (like { items: [...] })
        if (response.data.items && Array.isArray(response.data.items)) {
          files = response.data.items;
        } else {
          files = Object.values(response.data);
        }
      } else if (response && response.items && Array.isArray(response.items)) {
        files = response.items;
      } else {
        console.error('[Medical] Unexpected response format:', typeof response, JSON.stringify(response).substring(0, 200));
        files = [];
      }
      
      console.log('[Medical] Files received:', files.length, 'files');
      
      if (!files || files.length === 0) {
        await this.bot.sendMessage(chatId, 
          '📄 هنوز تاییدیه فعالی ثبت نشده است.\n\n' +
          'می‌توانید از منوی تاییدیه‌ها یک فایل جدید آپلود کنید.',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📤 آپلود تاییدیه', callback_data: 'medical_upload_start' },
                { text: '🏠 بازگشت', callback_data: 'menu_medical' }
              ]]
            }
          }
        );
        return;
      }

      // Create file list with download buttons
      const keyboardButtons = [];
      const fileList = files.map((file, idx) => {
        const fileInfo = `${idx + 1}. *${file.original_name || 'بدون نام'}*\n` +
          `   📋 برند: ${file.brand || 'نامشخص'}\n` +
          `   📦 کالا: ${file.product || 'نامشخص'}\n` +
          `   👤 بیمار: ${file.patient_name || 'نامشخص'}\n` +
          `   👨‍⚕️ پزشک: ${file.doctor_name || 'نامشخص'}\n` +
          `   🆔 ID: ${file.id}`;
        
        // Add download button for each file
        keyboardButtons.push([
          { 
            text: `📥 ${idx + 1}. ${(file.original_name || 'بدون نام').substring(0, 30)}${(file.original_name || '').length > 30 ? '...' : ''}`, 
            callback_data: `medical_download_${file.id}` 
          }
        ]);
        
        return fileInfo;
      }).join('\n\n');

      // Add navigation buttons
      const navButtons = [];
      
      // Filter buttons
      navButtons.push([
        { text: '🔍 جستجو', callback_data: 'medical_search_start' },
        { text: '🏷️ فیلتر برند', callback_data: 'medical_list_filter_brand' },
        { text: '📦 فیلتر کالا', callback_data: 'medical_list_filter_product' }
      ]);

      // Pagination buttons
      if (page > 0 || files.length === limit) {
        const paginationRow = [];
        if (page > 0) {
          paginationRow.push({ text: '◀️ قبلی', callback_data: `medical_list_page_${page - 1}` });
        }
        paginationRow.push({ text: `صفحه ${page + 1}`, callback_data: 'medical_list_info' });
        if (files.length === limit) {
          paginationRow.push({ text: '▶️ بعدی', callback_data: `medical_list_page_${page + 1}` });
        }
        navButtons.push(paginationRow);
      }

      // Back button
      navButtons.push([
        { text: '🏠 بازگشت به منو', callback_data: 'menu_medical' }
      ]);

      const keyboard = {
        reply_markup: {
          inline_keyboard: [...keyboardButtons, ...navButtons]
        }
      };

      const message = `📄 *لیست تاییدیه‌ها*\n\n` +
        `تعداد: ${files.length} فایل\n` +
        `صفحه: ${page + 1}\n\n` +
        `${fileList}\n\n` +
        `برای دانلود هر فایل، روی دکمه مربوطه کلیک کنید:`;

      await this.bot.sendMessage(chatId, message, {
        ...keyboard,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[HR] medical list error:', error);
      await this.bot.sendMessage(chatId, 
        `❌ خطا در دریافت لیست تاییدیه‌ها: ${error.message || 'خطای نامشخص'}\n\n` +
        `لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔄 تلاش مجدد', callback_data: 'medical_list' },
              { text: '🏠 بازگشت', callback_data: 'menu_medical' }
            ]]
          }
        }
      );
    }
  }

  async showMedicalCategories(chatId) {
    try {
      // دسته‌بندی‌های ثابت (درخواست نمونه، تایید برند)
      const categories = ['درخواست نمونه', 'تایید برند'];
      const text = categories.map(cat => `• ${cat}`).join('\n');
      await this.bot.sendMessage(chatId, `📁 *دسته‌بندی‌های تاییدیه*\n\n${text}`, {
        ...this.buildHrMenuKeyboard(),
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[HR] medical categories error:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در دریافت دسته‌بندی‌ها: ${error.message}`);
    }
  }

  async startMedicalSearch(chatId) {
    this.conversations.set(chatId, {
      step: 'medical_search',
      data: {}
    });

    await this.bot.sendMessage(chatId,
      '🔍 *جستجوی تاییدیه‌ها*\n\n' +
      'لطفاً کلمه کلیدی را وارد کنید:\n' +
      '(می‌توانید بر اساس نام بیمار، نام پزشک، برند، کالا یا نام فایل جستجو کنید)\n\n' +
      'برای لغو، "لغو" را ارسال کنید.',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ لغو', callback_data: 'medical_search_cancel' }
          ]]
        },
        parse_mode: 'Markdown'
      }
    );
  }

  async handleMedicalSearchMessage(msg, conversation) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (this.isCancelCommand(text)) {
      this.conversations.delete(chatId);
      await this.showMedicalMenu(chatId);
      return;
    }

    if (!text) {
      await this.bot.sendMessage(chatId, '❌ لطفاً کلمه کلیدی را وارد کنید یا "لغو" را بزنید.');
      return;
    }

    try {
      const response = await HrApi.listMedicalFiles({ search: text, limit: 10 });
      
      // Handle different response formats (same as showMedicalFiles)
      let files = [];
      if (Array.isArray(response)) {
        files = response;
      } else if (response && Array.isArray(response.data)) {
        files = response.data;
      } else if (response && response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        // If it's an object with items (like { items: [...] })
        if (response.data.items && Array.isArray(response.data.items)) {
          files = response.data.items;
        } else {
          files = Object.values(response.data);
        }
      } else if (response && response.items && Array.isArray(response.items)) {
        files = response.items;
      } else {
        console.error('[Medical] Search: Unexpected response format:', typeof response, JSON.stringify(response).substring(0, 200));
        files = [];
      }
      
      console.log('[Medical] Search results:', files.length, 'files found for:', text);
      
      if (!files || files.length === 0) {
        await this.bot.sendMessage(chatId,
          `❌ هیچ تاییدیه‌ای با کلمه کلیدی "${text}" یافت نشد.\n\n` +
          `لطفاً کلمه کلیدی دیگری را امتحان کنید یا "لغو" را بزنید.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ لغو', callback_data: 'medical_search_cancel' }
              ]]
            }
          }
        );
        return;
      }

      // Create keyboard with file options
      const keyboardButtons = files.map((file, idx) => [
        {
          text: `${idx + 1}. ${file.original_name || 'بدون نام'} - ${file.brand || ''} - ${file.product || ''}`,
          callback_data: `medical_download_${file.id}`
        }
      ]);

      keyboardButtons.push([
        { text: '🔍 جستجوی مجدد', callback_data: 'medical_search_start' },
        { text: '🏠 بازگشت', callback_data: 'menu_medical' }
      ]);

      // Escape Markdown special characters
      const escapeMarkdown = (text) => {
        if (!text) return 'نامشخص';
        return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      };

      const fileList = files.map((file, idx) => {
        return `${idx + 1}. ${escapeMarkdown(file.original_name || 'بدون نام')}\n` +
               `   برند: ${escapeMarkdown(file.brand)}\n` +
               `   کالا: ${escapeMarkdown(file.product)}\n` +
               `   بیمار: ${escapeMarkdown(file.patient_name)}\n` +
               `   پزشک: ${escapeMarkdown(file.doctor_name)}\n` +
               `   ID: ${file.id}`;
      }).join('\n\n');

      await this.bot.sendMessage(chatId,
        `🔍 *نتایج جستجو برای "${escapeMarkdown(text)}"*\n\n` +
        `${fileList}\n\n` +
        `برای دانلود فایل، روی گزینه مورد نظر کلیک کنید:`,
        {
          reply_markup: {
            inline_keyboard: keyboardButtons
          },
          parse_mode: 'Markdown'
        }
      );

      // Clear conversation after showing results
      this.conversations.delete(chatId);
    } catch (error) {
      console.error('[Medical] Search error:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در جستجو: ${error.message || 'خطای نامشخص'}`);
    }
  }

  async downloadAndSendMedicalFile(chatId, fileId) {
    try {
      // Show loading message
      const loadingMsg = await this.bot.sendMessage(chatId, '⏳ در حال دانلود فایل...');

      // Get file info first
      const files = await HrApi.listMedicalFiles({ limit: 1000 });
      const file = files.find(f => f.id === fileId);

      if (!file) {
        await this.bot.editMessageText('❌ فایل یافت نشد.', {
          chat_id: chatId,
          message_id: loadingMsg.message_id
        });
        return;
      }

      // Download file from App3 using HrApi helper
      const downloadResponse = await HrApi.downloadMedicalFile(fileId);

      // Send file to user
      const fileBuffer = Buffer.from(downloadResponse.data);
      const filename = file.original_name || file.file_name || `medical_file_${fileId}.pdf`;

      // Delete loading message
      await this.bot.deleteMessage(chatId, loadingMsg.message_id);

      // Build caption with description
      let caption = `📄 *${filename}*\n\n` +
                   `🏷️ برند: ${file.brand || 'نامشخص'}\n` +
                   `📦 کالا: ${file.product || 'نامشخص'}\n` +
                   `👤 بیمار: ${file.patient_name || 'نامشخص'}\n` +
                   `👨‍⚕️ پزشک: ${file.doctor_name || 'نامشخص'}\n` +
                   `📅 تاریخ: ${file.created_at ? new Date(file.created_at).toLocaleDateString('fa-IR') : 'نامشخص'}`;
      
      // Add description if available
      if (file.description && file.description.trim()) {
        caption += `\n\n📝 *توضیحات:*\n${file.description}`;
      }

      await this.bot.sendDocument(chatId, fileBuffer, {
        filename,
        caption,
        parse_mode: 'Markdown'
      });

      await this.bot.sendMessage(chatId, '✅ فایل با موفقیت ارسال شد.', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📄 لیست تاییدیه‌ها', callback_data: 'medical_list' },
              { text: '🔍 جستجو', callback_data: 'medical_search_start' }
            ],
            [
              { text: '🏠 بازگشت به منو', callback_data: 'menu_medical' }
            ]
          ]
        }
      });
    } catch (error) {
      console.error('[Medical] Download error:', error);
      await this.bot.sendMessage(chatId, 
        `❌ خطا در دانلود فایل: ${error.message || 'خطای نامشخص'}\n\n` +
        `لطفاً دوباره تلاش کنید.`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔄 تلاش مجدد', callback_data: `medical_download_${fileId}` },
              { text: '🏠 بازگشت', callback_data: 'menu_medical' }
            ]]
          }
        }
      );
    }
  }

  async startMedicalListFilter(chatId, filterType) {
    try {
      // Get all files to extract unique values
      const response = await HrApi.listMedicalFiles({ limit: 1000 });
      
      // Handle different response formats
      let files = [];
      if (Array.isArray(response)) {
        files = response;
      } else if (response && Array.isArray(response.data)) {
        files = response.data;
      } else if (response && response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        if (response.data.items && Array.isArray(response.data.items)) {
          files = response.data.items;
        } else {
          files = Object.values(response.data);
        }
      } else if (response && response.items && Array.isArray(response.items)) {
        files = response.items;
      } else {
        console.error('[Medical] Filter: Unexpected response format:', typeof response);
        files = [];
      }
      
      let uniqueValues = [];
      let filterLabel = '';
      
      if (filterType === 'brand') {
        uniqueValues = [...new Set(files.map(f => f.brand).filter(b => b))];
        filterLabel = 'برند';
      } else if (filterType === 'product') {
        uniqueValues = [...new Set(files.map(f => f.product).filter(p => p))];
        filterLabel = 'کالا';
      }

      if (uniqueValues.length === 0) {
        await this.bot.sendMessage(chatId, 
          `❌ هیچ ${filterLabel}ی یافت نشد.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📄 لیست تاییدیه‌ها', callback_data: 'medical_list' },
                { text: '🏠 بازگشت', callback_data: 'menu_medical' }
              ]]
            }
          }
        );
        return;
      }

      // Create keyboard with filter options
      const keyboardButtons = uniqueValues.slice(0, 10).map(value => [
        { 
          text: value, 
          callback_data: `medical_list_filter_${filterType}_${encodeURIComponent(value)}` 
        }
      ]);

      keyboardButtons.push([
        { text: '❌ حذف فیلتر', callback_data: 'medical_list_clear_filter' },
        { text: '🏠 بازگشت', callback_data: 'menu_medical' }
      ]);

      await this.bot.sendMessage(chatId,
        `🔍 *فیلتر بر اساس ${filterLabel}*\n\n` +
        `لطفاً ${filterLabel} مورد نظر را انتخاب کنید:`,
        {
          reply_markup: {
            inline_keyboard: keyboardButtons
          },
          parse_mode: 'Markdown'
        }
      );
    } catch (error) {
      console.error('[Medical] Filter error:', error);
      await this.bot.sendMessage(chatId, 
        `❌ خطا در دریافت فیلترها: ${error.message || 'خطای نامشخص'}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '📄 لیست تاییدیه‌ها', callback_data: 'medical_list' },
              { text: '🏠 بازگشت', callback_data: 'menu_medical' }
            ]]
          }
        }
      );
    }
  }

  async handleAiVoiceCommand(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id?.toString() || 'Unknown';
    console.log(`[AI] Voice command received from ${telegramId}`);

    const personnel = await this.getPersonnelByTelegramId(telegramId);
    if (!personnel) {
      await this.bot.sendMessage(chatId, '❌ برای استفاده از قابلیت هوشمند باید در سیستم ثبت شده باشید.');
      return;
    }

    if (!this.aiRouter?.isEnabled()) {
      await this.bot.sendMessage(chatId,
        '🤖 قابلیت هوش مصنوعی فعال نشده است یا کلید GEMINI تنظیم نشده است.\n' +
        'لطفاً با مدیر سیستم تماس بگیرید.'
      );
      return;
    }

    if (!this.speechService) {
      this.speechService = new SpeechService(this.bot);
    }

    const fileId = msg.voice?.file_id || msg.audio?.file_id;
    if (!fileId) {
      await this.bot.sendMessage(chatId, '❌ فایل صوتی یافت نشد.');
      return;
    }

    let statusMessage = null;
    try {
      statusMessage = await this.bot.sendMessage(chatId, '🎙️ در حال پردازش وویس شما...');
      const transcription = await this.speechService.transcribeTelegramVoice(fileId);

      if (!transcription) {
        await this.bot.editMessageText('❌ متن قابل استخراج نبود. لطفاً دوباره تلاش کنید.', {
          chat_id: chatId,
          message_id: statusMessage.message_id
        });
        return;
      }

      await this.bot.editMessageText(
        `🗣️ *متن تشخیص داده‌شده:*\n${transcription}`,
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
          parse_mode: 'Markdown'
        }
      );

      const aiResult = await this.aiRouter.interpret(transcription, {
        userName: msg.from?.first_name || msg.from?.username || 'کاربر',
        userRole: msg.from?.username || 'نامشخص'
      });
      const { result: enrichedResult } = this.enrichAiResultWithHeuristics(aiResult, transcription);
      if (!enrichedResult) {
        await this.bot.sendMessage(chatId,
          '❌ متن شما تحلیل نشد. لطفاً دوباره تلاش کنید یا اطلاعات بیشتری بدهید.'
        );
        return;
      }

      await this.executeAiIntent(chatId, enrichedResult, transcription, {
        personnel,
        telegramId,
        inputType: 'voice',
        chatId
      });
    } catch (error) {
      console.error('[AI] Failed to process voice command:', error);
      if (statusMessage) {
        await this.bot.editMessageText(
          '❌ خطا در پردازش وویس. لطفاً دوباره تلاش کنید یا از روش متنی استفاده کنید.',
          {
            chat_id: chatId,
            message_id: statusMessage.message_id
          }
        );
      } else {
        await this.bot.sendMessage(chatId, '❌ خطا در پردازش وویس. لطفاً دوباره تلاش کنید.');
      }
    }
  }

  async handleAiTextCommand(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const telegramId = msg.from?.id?.toString() || 'Unknown';
    console.log(`[AI] Text command received from ${telegramId}: "${text}"`);

    const personnel = await this.getPersonnelByTelegramId(telegramId);
    if (!personnel) {
      await this.bot.sendMessage(chatId, '❌ برای استفاده از قابلیت هوشمند باید در سیستم ثبت شده باشید.');
      return;
    }

    if (!text) {
      await this.bot.sendMessage(chatId, '❌ متن خالی است. لطفاً دوباره تلاش کنید.');
      return;
    }

    console.log(`[handleAiTextCommand] aiRouter exists: ${!!this.aiRouter}, isEnabled: ${this.aiRouter?.isEnabled()}`);
    
    if (!this.aiRouter?.isEnabled()) {
      await this.bot.sendMessage(chatId,
        '🤖 قابلیت هوش مصنوعی فعال نشده است یا کلید GEMINI تنظیم نشده است.\n' +
        'لطفاً با مدیر سیستم تماس بگیرید.'
      );
      return;
    }

    const statusMessage = await this.bot.sendMessage(chatId, '🤖 در حال تحلیل متن...');

    try {
      console.log(`[handleAiTextCommand] Calling interpret with text: "${text.substring(0, 50)}..."`);
      const aiResult = await this.aiRouter.interpret(text, {
        userName: msg.from?.first_name || msg.from?.username || 'کاربر',
        userRole: msg.from?.username || 'نامشخص'
      });
      console.log(`[handleAiTextCommand] Received aiResult:`, JSON.stringify(aiResult, null, 2));

      await this.bot.editMessageText('✅ متن شما تحلیل شد. نتایج در پیام بعدی آمده است.', {
        chat_id: chatId,
        message_id: statusMessage.message_id
      });

      const { result: enrichedResult } = this.enrichAiResultWithHeuristics(aiResult, text);
      if (!enrichedResult) {
        await this.bot.editMessageText(
          '❌ هوش مصنوعی پاسخی نداد. لطفاً دوباره تلاش کنید.',
          {
            chat_id: chatId,
            message_id: statusMessage.message_id
          }
        );
        await this.bot.sendMessage(chatId,
          '❌ مدل اصلی و تشخیص کمکی هر دو ناموفق بودند. لطفاً درخواست را واضح‌تر بنویسید.'
        );
        return;
      }

      await this.executeAiIntent(chatId, enrichedResult, text, {
        personnel,
        telegramId,
        inputType: 'text',
        chatId
      });
    } catch (error) {
      console.error('[AI] Failed to process text command:', error);
      await this.bot.editMessageText(
        '❌ خطا در تحلیل متن. لطفاً دوباره تلاش کنید.',
        {
          chat_id: chatId,
          message_id: statusMessage.message_id
        }
      );
      await this.bot.sendMessage(chatId, '❌ خطای فنی: ' + (error.message || 'نامشخص'));
    }
  }

  async executeAiIntent(chatId, aiResult, originalInput, context = {}) {
    if (!aiResult) {
      await this.bot.sendMessage(chatId, '❌ هوش مصنوعی پاسخی برنگرداند.');
      return;
    }

    const { intent, confidence, fields, response, followUpQuestion } = aiResult;
    const confidencePercent = (confidence * 100).toFixed(1);

    const messages = [
      '🤖 *نتیجه تحلیل هوش مصنوعی*',
      `• Intent تشخیص داده‌شده: \`${intent}\``,
      `• اطمینان: ${confidencePercent}%`
    ];
    const inlineButtons = [];

    const pushCardLinkButton = (link) => {
      if (!link) return;
      inlineButtons.push([
        { text: '👀 مشاهده در برد عملیات', url: link }
      ]);
    };

    if (aiResult.heuristic) {
      messages.push('\nℹ️ چون پاسخ مدل اصلی نامشخص بود، از تشخیص کمکی استفاده شد.');
    }

    const formattedFields = this.formatFieldsForDisplay(fields);
    if (formattedFields) {
      messages.push('\n📋 اطلاعات استخراج شده:\n' + formattedFields);
    }

    if (response) {
      messages.push('\n' + response);
    }

    let actionHandled = false;
    let actionSuccess = false;

    if (intent === 'create_contact') {
      const actionResult = await this.handleAiIntentCreateContact(fields, context, originalInput, chatId);
      actionHandled = !!actionResult?.handled;
      actionSuccess = !!actionResult?.success;
      if (actionResult?.message) {
        messages.push('\n' + actionResult.message);
      }
      if (actionResult?.cardLink) {
        pushCardLinkButton(actionResult.cardLink);
      }
    }

    if (intent === 'create_assignment') {
      const actionResult = await this.handleAiIntentCreateAssignment(fields, context, originalInput);
      actionHandled = !!actionResult?.handled;
      actionSuccess = !!actionResult?.success;
      if (actionResult?.message) {
        messages.push('\n' + actionResult.message);
      }
      if (actionResult?.cardLink) {
        pushCardLinkButton(actionResult.cardLink);
      }
    }

    if (intent === 'request_leave') {
      const actionResult = await this.handleAiIntentRequestLeave(fields, context, originalInput, chatId);
      actionHandled = !!actionResult?.handled;
      actionSuccess = !!actionResult?.success;
      if (actionResult?.message) {
        messages.push('\n' + actionResult.message);
      }
    }

    if (intent === 'request_report') {
      const actionResult = await this.handleAiIntentRequestReport(fields, context, originalInput, chatId);
      actionHandled = !!actionResult?.handled;
      actionSuccess = !!actionResult?.success;
      if (actionResult?.message) {
        messages.push('\n' + actionResult.message);
      }
    }

    if (intent === 'medical_request') {
      actionHandled = true;
      try {
        await this.handleAiMedicalRequest(chatId, context, fields, originalInput);
        actionSuccess = true;
        // پیام موفقیت در خود handleAiMedicalRequest ارسال می‌شود
        return; // جلوگیری از ارسال پیام تکراری
      } catch (error) {
        console.error('[AI] Failed to start medical flow:', error);
        actionSuccess = false;
        messages.push('\n❌ خطا در باز کردن فلوی تاییدیه‌ها. لطفاً دوباره تلاش کنید.');
      }
    }

    if (intent === 'center_info') {
      actionHandled = true;
      actionSuccess = false;
      messages.push('\n📚 برای مشاهده یا ویرایش اطلاعات مراکز از مسیر «📝 تکمیل اطلاعات مرکز» یا منوی مراکز استفاده کنید.');
    }

    if (followUpQuestion) {
      messages.push(`\n❓ ${followUpQuestion}`);
      this.startAiFollowupConversation(chatId, {
        originalInput,
        context,
        lastResult: aiResult
      });
    } else {
      this.clearAiFollowupConversation(chatId);
    }

    if (!actionHandled) {
      messages.push(
        '\nℹ️ در حال حاضر این قابلیت در مرحله آزمایشی است. ' +
        'به‌زودی به صورت خودکار ماموریت‌ها و تماس‌ها را نیز ثبت خواهد کرد.'
      );
    }

    const replyOptions = { parse_mode: 'Markdown' };
    if (inlineButtons.length > 0) {
      replyOptions.reply_markup = { inline_keyboard: inlineButtons };
    }
    await this.bot.sendMessage(chatId, messages.join('\n'), replyOptions);
  }

  startAiFollowupConversation(chatId, payload) {
    if (!payload) return;
    const existing = this.conversations.get(chatId);
    if (existing?.type === 'ai_followup') {
      this.conversations.delete(chatId);
    }

    this.conversations.set(chatId, {
      type: 'ai_followup',
      originalInput: payload.originalInput,
      context: payload.context,
      lastResult: payload.lastResult,
      createdAt: Date.now()
    });
    console.log(`[AI Followup] Waiting for user response in chat ${chatId}`);
  }

  clearAiFollowupConversation(chatId) {
    const conversation = this.conversations.get(chatId);
    if (conversation?.type === 'ai_followup') {
      this.conversations.delete(chatId);
    }
  }

  async handleAiFollowupMessage(msg, conversation, answerText) {
    const chatId = msg.chat.id;
    this.conversations.delete(chatId);

    const telegramId = conversation.context?.telegramId || msg.from?.id?.toString() || 'Unknown';
    const personnel = conversation.context?.personnel || await this.getPersonnelByTelegramId(telegramId);
    const combinedInput = `${conversation.originalInput || ''}\nپاسخ کاربر: ${answerText}`;

    const displayName = msg.from?.first_name || msg.from?.username || 'کاربر';
    const userRole = msg.from?.username || 'نامشخص';

    try {
      const aiResult = await this.aiRouter.interpret(combinedInput, {
        userName: displayName,
        userRole
      });

      const { result: enrichedResult } = this.enrichAiResultWithHeuristics(aiResult, combinedInput);
      if (!enrichedResult) {
        await this.bot.sendMessage(chatId,
          '❌ نتوانستیم پاسخ شما را تحلیل کنیم. لطفاً درخواست جدیدی ثبت کنید.'
        );
        return;
      }

      await this.executeAiIntent(chatId, enrichedResult, combinedInput, {
        ...conversation.context,
        personnel,
        telegramId,
        chatId,
        inputType: 'text'
      });
    } catch (error) {
      console.error('[AI] Failed to process follow-up response:', error);
      await this.bot.sendMessage(chatId, '❌ خطا در پردازش پاسخ. لطفاً دوباره تلاش کنید.');
    }
  }

  async handleAiIntentCreateContact(fields = {}, context = {}, originalInput = '', chatId = null) {
    try {
      const personnel = context.personnel;
      if (!personnel) {
        return {
          handled: true,
          success: false,
          message: '❌ کاربر در سیستم ثبت نشده است. لطفاً ابتدا از طریق /start ثبت نام کنید.'
        };
      }

      const multiCenters = this.extractCenterNamesList(fields, originalInput);
      if (multiCenters.length > 1 && chatId) {
        const normalizedContactType = this.determineContactType(fields);
        await this.startAiMultiContactFlow(chatId, multiCenters, {
          ...context,
          personnel,
          telegramId: context.telegramId || personnel.telegramId || (context?.telegramId ?? null)
        }, {
          ...fields,
          contactType: normalizedContactType || 'phone'
        }, originalInput);
        return {
          handled: true,
          success: false,
          message: `✅ درخواست ثبت ${multiCenters.length} تماس دریافت شد. لطفاً هر مرکز را از لیست انتخاب کنید تا تماس‌ها یکی‌یکی ثبت شوند.`
        };
      }

      const centerResolution = await this.ensureAiCenterSelection(fields, context, originalInput, 'create_contact');
      if (centerResolution.pendingSelection) {
        return {
          handled: true,
          success: false,
          message: '⚠️ مرکز دقیق مشخص نشد. لطفاً از بین پیشنهادها انتخاب کنید.'
        };
      }

      if (centerResolution.errorMessage) {
        return {
          handled: true,
          success: false,
          message: centerResolution.errorMessage
        };
      }

      const center = centerResolution.center;
      if (!center) {
        return {
          handled: true,
          success: false,
          message: '⚠️ مرکز موردنظر پیدا نشد. لطفاً نام دقیق مرکز را بگویید یا ابتدا مرکز را ثبت کنید.'
        };
      }

      const pendingFields = {
        ...fields,
        centerId: center.id,
        centerName: center.name,
        centerCity: center.city || fields.centerCity
      };

      let contactType = this.determineContactType(fields, center);
      if (!contactType) {
        if (chatId) {
          await this.promptAiContactRegion(chatId, {
            fields: pendingFields,
            context,
            originalInput
          });
          return {
            handled: true,
            success: false,
            message: '❓ لطفاً مشخص کنید این تماس مربوط به تهران است یا استان تا بتوانیم آن را ثبت کنیم.'
          };
        }
        contactType = 'province';
      }

      fields.contactType = contactType;
      const notes = this.buildContactNotes(fields, originalInput);

      const contact = await Contact.create({
        personnelId: personnel.id,
        centerId: center.id,
        contactType,
        notes,
        tags: fields.tags || null
      });
      const cardLink = await workflowBoardService.getCardLinkForEntity('contact', contact.id);

      return {
        handled: true,
        success: true,
        contact,
        cardLink,
        message:
          `✅ تماس با موفقیت ثبت شد (کد ${contact.id})\n` +
          `🏢 مرکز: ${contact.centerName || center.name}\n` +
          `📍 نوع تماس: ${contact.contactType === 'tehran' ? 'تهران' : 'استان'}`
      };
    } catch (error) {
      console.error('[AI] Failed to create contact:', error);
      return {
        handled: true,
        success: false,
        message: '❌ خطا در ثبت تماس: ' + (error.message || 'نامشخص')
      };
    }
  }

  async handleAiIntentCreateAssignment(fields = {}, context = {}, originalInput = '') {
    try {
      const personnel = context.personnel;
      if (!personnel) {
        return {
          handled: true,
          success: false,
          message: '❌ کاربر در سیستم ثبت نشده است. لطفاً ابتدا از طریق /start ثبت نام کنید.'
        };
      }

      const centerResolution = await this.ensureAiCenterSelection(fields, context, originalInput, 'create_assignment');
      if (centerResolution.pendingSelection) {
        return {
          handled: true,
          success: false,
          message: '⚠️ لطفاً مرکز صحیح را از لیست پیشنهاد شده انتخاب کنید.'
        };
      }

      if (centerResolution.errorMessage) {
        return {
          handled: true,
          success: false,
          message: centerResolution.errorMessage
        };
      }

      const center = centerResolution.center;
      if (!center) {
        return {
          handled: true,
          success: false,
          message: '⚠️ مرکز مورد نظر پیدا نشد. لطفاً نام دقیق مرکز را بگویید یا ابتدا مرکز را ثبت کنید.'
        };
      }

      let missionPersonnelId = personnel.id;
      if (fields.assignee) {
        const assignee = await Personnel.findByNameOrUsername(fields.assignee);
        if (assignee) {
          missionPersonnelId = assignee.id;
        }
      }

      const missionData = {
        personnelId: missionPersonnelId,
        centerId: center.id,
        managerId: personnel.role === 'manager' ? personnel.id : null,
        notes: fields.notes || fields.summary || originalInput,
        centerNotes: fields.centerNotes || null,
        snapLocationLatitude: fields.latitude || null,
        snapLocationLongitude: fields.longitude || null,
        snapLocationAddress: fields.address || null,
        snapCost: fields.snapCost || null,
        discountCode: fields.discountCode || null,
        discountCodeId: fields.discountCodeId || null,
        personalPayment: fields.personalPayment || null
      };

      const mission = await AssignmentModel.create(missionData);
      const cardLink = await workflowBoardService.getCardLinkForEntity('mission', mission.id);

      // ارسال نوتیفیکیشن به مدیران
      await this.notifyNewAssignment(mission);

      return {
        handled: true,
        success: true,
        mission,
        cardLink,
        message:
          `✅ مأموریت با موفقیت ثبت شد (کد ${mission.id})\n` +
          `👤 پرسنل: ${mission.personnelName}\n` +
          `🏢 مرکز: ${mission.centerName}\n` +
          `💡 ماموریت برای تایید به مدیر ارسال شد.`
      };
    } catch (error) {
      console.error('[AI] Failed to create assignment:', error);
      return {
        handled: true,
        success: false,
        message: '❌ خطا در ثبت مأموریت: ' + (error.message || 'نامشخص')
      };
    }
  }

  async handleAiIntentRequestLeave(fields = {}, context = {}, originalInput = '', chatId) {
    try {
      const telegramId = context.telegramId;
      if (!telegramId) {
        return {
          handled: true,
          success: false,
          message: '❌ نمی‌توان مرخصی را ثبت کرد؛ شناسه تلگرام معتبر نیست.'
        };
      }

      const hrCtx = await this.prepareHrContext(telegramId, chatId);
      if (!hrCtx) {
        return {
          handled: true,
          success: false,
          message: '❌ اتصال به واحد منابع انسانی برقرار نشد.'
        };
      }

      const employee = hrCtx.employee;
      const leaveType = this.normalizeAiLeaveType(fields.leaveType || fields.type);
      const startDate = this.parseAiDate(
        fields.startDate ||
        fields.date ||
        fields.fromDate ||
        fields.beginDate
      );

      if (!startDate) {
        return {
          handled: true,
          success: false,
          message: '⚠️ تاریخ شروع مرخصی مشخص نیست. لطفاً تاریخ را به صورت 1403-01-15 اعلام کنید.'
        };
      }

      let endDate = this.parseAiDate(fields.endDate || fields.toDate || fields.finishDate) || startDate;
      let daysCount = fields.days || fields.daysCount || null;
      if (!daysCount && startDate && endDate) {
        daysCount = this.calculateDaysCount(startDate, endDate);
      }

      const payload = {
        employee_id: employee.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount || undefined,
        reason: fields.reason || fields.notes || originalInput
      };

      if (leaveType === 'hourly') {
        const startTime = this.parseAiTime(fields.startTime || fields.time || fields.beginTime);
        const endTime = this.parseAiTime(fields.endTime || fields.finishTime);
        if (!startTime || !endTime) {
          return {
            handled: true,
            success: false,
            message: '⚠️ برای مرخصی ساعتی باید ساعت شروع و پایان مشخص باشد (مثلاً 09:00 تا 12:00).'
          };
        }
        payload.start_time = startTime;
        payload.end_time = endTime;
        payload.duration_hours = fields.duration || this.calculateHourlyDuration(startDate, startTime, endTime) || undefined;
      }

      const leave = await HrApi.createLeaveRequest(payload);

      return {
        handled: true,
        success: true,
        leave,
        message:
          `✅ مرخصی با موفقیت ثبت شد (کد ${leave?.id || ''})\n` +
          `📅 ${this.formatPersianDate(startDate)} تا ${this.formatPersianDate(endDate)}\n` +
          `🗂 نوع: ${this.mapLeaveTypeLabel(leaveType)}`
      };
    } catch (error) {
      console.error('[AI] Failed to create leave request:', error);
      const detail = error?.response?.data?.detail || error?.response?.data?.error;
      return {
        handled: true,
        success: false,
        message: '❌ خطا در ثبت مرخصی: ' + (detail || error.message || 'نامشخص')
      };
    }
  }

  async handleAiIntentRequestReport(fields = {}, context = {}, originalInput = '', chatId) {
    try {
      const personnel = context.personnel;
      if (!personnel) {
        return {
          handled: true,
          success: false,
          message: '❌ کاربر در سیستم ثبت نشده است. لطفاً ابتدا از طریق /start ثبت نام کنید.'
        };
      }

      // تعیین نوع گزارش از fields
      const reportType = this.determineReportType(fields, originalInput);
      const timeRange = this.determineTimeRange(fields, originalInput);
      const contactTypeFilter = this.determineContactTypeFilter(fields, originalInput);

      // محاسبه تاریخ‌های شروع و پایان
      const { startDate, endDate } = this.calculateDateRange(timeRange);

      let reportMessage = '';
      let reportData = null;

      if (reportType === 'assignments' || reportType === 'missions') {
        // گزارش ماموریت‌ها
        const assignments = await AssignmentModel.getAll({
          personnelId: personnel.id,
          limit: 100
        });

        // فیلتر بر اساس بازه زمانی
        const filteredAssignments = assignments.filter(a => {
          const createdAt = new Date(a.createdAt);
          return createdAt >= startDate && createdAt <= endDate;
        });

        reportData = {
          type: 'assignments',
          assignments: filteredAssignments,
          stats: this.calculateReportStats(filteredAssignments)
        };

        reportMessage = this.buildAssignmentsReportMessage(reportData, timeRange);
      } else if (reportType === 'contacts') {
        // گزارش تماس‌ها
        const contacts = await Contact.getAll({
          personnelId: personnel.id,
          contactType: contactTypeFilter || undefined,
          limit: 100
        });

        // فیلتر بر اساس بازه زمانی
        const filteredContacts = contacts.filter(c => {
          const createdAt = new Date(c.createdAt);
          return createdAt >= startDate && createdAt <= endDate;
        });

        reportData = {
          type: 'contacts',
          contacts: filteredContacts,
          stats: this.calculateContactsStats(filteredContacts)
        };

        reportMessage = this.buildContactsReportMessage(reportData, timeRange, contactTypeFilter);
      } else {
        // گزارش ترکیبی (هم ماموریت و هم تماس)
        const assignments = await AssignmentModel.getAll({
          personnelId: personnel.id,
          limit: 50
        });
        const contacts = await Contact.getAll({
          personnelId: personnel.id,
          limit: 50
        });

        const filteredAssignments = assignments.filter(a => {
          const createdAt = new Date(a.createdAt);
          return createdAt >= startDate && createdAt <= endDate;
        });

        const filteredContacts = contacts.filter(c => {
          const createdAt = new Date(c.createdAt);
          return createdAt >= startDate && createdAt <= endDate;
        });

        reportData = {
          type: 'combined',
          assignments: filteredAssignments,
          contacts: filteredContacts,
          assignmentStats: this.calculateReportStats(filteredAssignments),
          contactStats: this.calculateContactsStats(filteredContacts)
        };

        reportMessage = this.buildCombinedReportMessage(reportData, timeRange);
      }

      return {
        handled: true,
        success: true,
        reportData,
        message: reportMessage
      };
    } catch (error) {
      console.error('[AI] Failed to generate report:', error);
      return {
        handled: true,
        success: false,
        message: '❌ خطا در تهیه گزارش: ' + (error.message || 'نامشخص')
      };
    }
  }

  determineReportType(fields = {}, originalInput = '') {
    const input = (originalInput || '').toLowerCase();
    const reportType = (fields.reportType || fields.type || '').toLowerCase();

    if (['ماموریت', 'mission', 'assignment', 'سفر', 'ماموریت‌ها'].some(keyword => 
      input.includes(keyword) || reportType.includes(keyword)
    )) {
      return 'assignments';
    }

    if (['تماس', 'contact', 'تماس‌ها', 'ارتباط'].some(keyword => 
      input.includes(keyword) || reportType.includes(keyword)
    )) {
      return 'contacts';
    }

    return 'combined'; // پیش‌فرض: گزارش ترکیبی
  }

  determineTimeRange(fields = {}, originalInput = '') {
    const input = (originalInput || '').toLowerCase();
    const timeRange = (fields.timeRange || fields.period || fields.range || '').toLowerCase();

    if (['هفته', 'week', 'هفتگی', 'این هفته'].some(keyword => 
      input.includes(keyword) || timeRange.includes(keyword)
    )) {
      return 'week';
    }

    if (['ماه', 'month', 'ماهانه', 'این ماه'].some(keyword => 
      input.includes(keyword) || timeRange.includes(keyword)
    )) {
      return 'month';
    }

    if (['روز', 'day', 'امروز', 'روزانه'].some(keyword => 
      input.includes(keyword) || timeRange.includes(keyword)
    )) {
      return 'day';
    }

    return 'all'; // پیش‌فرض: همه زمان‌ها
  }

  determineContactTypeFilter(fields = {}, originalInput = '') {
    const input = (originalInput || '').toLowerCase();
    const contactType = (fields.contactType || '').toLowerCase();

    if (['تهران', 'tehran', 'تهرانی'].some(keyword => 
      input.includes(keyword) || contactType.includes(keyword)
    )) {
      return 'tehran';
    }

    if (['استان', 'province', 'شهرستان', 'شهر'].some(keyword => 
      input.includes(keyword) || contactType.includes(keyword)
    )) {
      return 'province';
    }

    return null; // همه انواع
  }

  calculateDateRange(timeRange) {
    const now = new Date();
    let startDate = new Date(0); // ابتدای تاریخ
    let endDate = new Date(now);

    if (timeRange === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeRange === 'week') {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    } else if (timeRange === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  }

  calculateContactsStats(contacts) {
    const stats = {
      total: contacts.length,
      byType: {},
      byCity: {}
    };

    contacts.forEach(c => {
      const type = c.contactType || 'نامشخص';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      const city = c.centerCity || 'نامشخص';
      stats.byCity[city] = (stats.byCity[city] || 0) + 1;
    });

    return stats;
  }

  buildAssignmentsReportMessage(reportData, timeRange) {
    const { assignments, stats } = reportData;
    const timeRangeLabel = this.getTimeRangeLabel(timeRange);

    let message = `📊 گزارش ماموریت‌ها (${timeRangeLabel})\n\n`;
    message += `📋 آمار کلی:\n`;
    message += `   • کل ماموریت‌ها: ${stats.total}\n`;

    const statusOrder = ['pending', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled'];
    statusOrder.forEach(status => {
      if (stats.byStatus[status]) {
        message += `   • ${this.getStatusLabel(status)}: ${stats.byStatus[status]}\n`;
      }
    });

    message += `\n💰 هزینه‌ها:\n`;
    message += `   • مجموع هزینه اسنپ: ${this.formatCurrency(stats.totalSnapCost)} تومان\n`;
    message += `   • مجموع تخفیف: ${this.formatCurrency(stats.totalDiscount)} تومان\n`;
    message += `   • مجموع هزینه کل: ${this.formatCurrency(stats.totalCost)} تومان\n`;

    message += `\n`;
    message += this.buildAssignmentsList(assignments, 10);

    return message;
  }

  buildContactsReportMessage(reportData, timeRange, contactTypeFilter) {
    const { contacts, stats } = reportData;
    const timeRangeLabel = this.getTimeRangeLabel(timeRange);
    const typeLabel = contactTypeFilter ? (contactTypeFilter === 'tehran' ? 'تهران' : 'استان') : 'همه';

    let message = `📞 گزارش تماس‌ها (${timeRangeLabel})\n`;
    message += `نوع: ${typeLabel}\n\n`;
    message += `📋 آمار کلی:\n`;
    message += `   • کل تماس‌ها: ${stats.total}\n`;

    Object.keys(stats.byType).forEach(type => {
      const typeLabel = type === 'tehran' ? 'تهران' : type === 'province' ? 'استان' : type;
      message += `   • ${typeLabel}: ${stats.byType[type]}\n`;
    });

    if (Object.keys(stats.byCity).length > 0) {
      message += `\n📍 بر اساس شهر:\n`;
      const sortedCities = Object.entries(stats.byCity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      sortedCities.forEach(([city, count]) => {
        message += `   • ${city}: ${count}\n`;
      });
    }

    message += `\n`;
    message += this.buildContactsList(contacts, 10);

    return message;
  }

  buildCombinedReportMessage(reportData, timeRange) {
    const { assignments, contacts, assignmentStats, contactStats } = reportData;
    const timeRangeLabel = this.getTimeRangeLabel(timeRange);

    let message = `📊 گزارش عملکرد (${timeRangeLabel})\n\n`;

    message += `📋 ماموریت‌ها:\n`;
    message += `   • کل ماموریت‌ها: ${assignmentStats.total}\n`;
    const statusOrder = ['pending', 'approved', 'in-progress', 'completed'];
    statusOrder.forEach(status => {
      if (assignmentStats.byStatus[status]) {
        message += `   • ${this.getStatusLabel(status)}: ${assignmentStats.byStatus[status]}\n`;
      }
    });

    message += `\n📞 تماس‌ها:\n`;
    message += `   • کل تماس‌ها: ${contactStats.total}\n`;
    Object.keys(contactStats.byType).forEach(type => {
      const typeLabel = type === 'tehran' ? 'تهران' : type === 'province' ? 'استان' : type;
      message += `   • ${typeLabel}: ${contactStats.byType[type]}\n`;
    });

    message += `\n💰 هزینه کل ماموریت‌ها: ${this.formatCurrency(assignmentStats.totalCost)} تومان\n`;

    return message;
  }

  buildContactsList(contacts, limit = 10) {
    if (!contacts.length) {
      return '❌ در این بازه تماسی ثبت نشده است.';
    }

    let message = '';
    contacts.slice(0, limit).forEach((contact, index) => {
      const centerName = (contact.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const typeLabel = contact.contactType === 'tehran' ? 'تهران' : contact.contactType === 'province' ? 'استان' : contact.contactType;
      const dateStr = contact.createdAt ? this.formatPersianDate(contact.createdAt) : '';
      message += `${index + 1}. ${centerName} - ${typeLabel}${dateStr ? ` (${dateStr})` : ''}\n`;
    });

    if (contacts.length > limit) {
      message += `\n... و ${contacts.length - limit} تماس دیگر`;
    }

    return message;
  }

  getTimeRangeLabel(timeRange) {
    const labels = {
      day: 'امروز',
      week: 'این هفته',
      month: 'این ماه',
      all: 'همه زمان‌ها'
    };
    return labels[timeRange] || 'همه زمان‌ها';
  }

  async resolveCenterFromFields(fields = {}) {
    if (fields.centerId) {
      const center = await Center.getById(fields.centerId);
      if (center) {
        return center;
      }
    }

    const searchTerm = this.extractCenterSearchTerm(fields);
    if (!searchTerm) {
      return null;
    }

    const candidates = await this.findCenterSuggestions(searchTerm, fields.centerCity || fields.city, 5);

    if (!candidates || !candidates.length) {
      return null;
    }

    return candidates[0];
  }

  extractCenterSearchTerm(fields = {}) {
    // اول centerName را چک کن
    if (fields.centerName) {
      return typeof fields.centerName === 'string' ? fields.centerName.trim() : String(fields.centerName || '').trim();
    }
    
    // اگر centerCandidates وجود دارد، اولی را برگردان
    if (Array.isArray(fields.centerCandidates) && fields.centerCandidates.length > 0) {
      const first = fields.centerCandidates[0];
      return typeof first === 'string' ? first.trim() : String(first || '').trim();
    }
    
    // در غیر این صورت از فیلدهای دیگر استفاده کن
    const term =
      fields.center ||
      fields.organization ||
      fields.company ||
      '';
    return typeof term === 'string' ? term.trim() : String(term || '').trim();
  }

  enrichAiResultWithHeuristics(aiResult, originalInput) {
    const detection = this.detectHeuristicIntent(originalInput);
    if (!this.shouldUseAiHeuristic(aiResult, originalInput, detection)) {
      return { result: aiResult, heuristicUsed: false };
    }

    const heuristicResult = detection
      ? this.buildHeuristicAiResult(originalInput, aiResult, detection)
      : null;
    if (heuristicResult) {
      return { result: heuristicResult, heuristicUsed: true };
    }

    return { result: aiResult, heuristicUsed: false };
  }

  shouldUseAiHeuristic(aiResult, originalInput, detection) {
    if (!originalInput || !originalInput.trim()) {
      return false;
    }
    if (!detection) {
      return false;
    }

    if (!aiResult) {
      return true;
    }
    const intent = aiResult.intent || 'unknown';
    if (intent === 'unknown') {
      return true;
    }
    const confidence = typeof aiResult.confidence === 'number' ? aiResult.confidence : 0;
    if (confidence < 0.2) {
      return true;
    }

    if (detection.intent && detection.intent !== intent) {
      // تاییدیه پزشکی همیشه اولویت دارد
      if (detection.intent === 'medical_request') {
        return true;
      }
      // تماس باید از ماموریت جدا شود
      if (detection.intent === 'create_contact' && intent === 'create_assignment' && detection.confidence >= 0.55) {
        return true;
      }
      // اطلاعات مرکز
      if (detection.intent === 'center_info' && detection.confidence >= 0.6) {
        return true;
      }
      // اگر تشخیص کمکی با فاصله‌ی قابل توجه بهتر است
      if (detection.confidence - confidence >= 0.2) {
        return true;
      }
    }

    return false;
  }

  buildHeuristicAiResult(originalInput = '', currentResult = null, detection = null) {
    const trimmed = (originalInput || '').trim();
    if (!trimmed) {
      return null;
    }
    const detectedIntent = detection?.intent || 'create_assignment';
    const baseFields = this.cloneSimpleObject(currentResult?.fields || {});

    if (!baseFields.notes) {
      baseFields.notes = trimmed;
    }

    const centerCandidate = this.extractCenterNameFromText(trimmed);
    if (centerCandidate) {
      if (!baseFields.centerName) baseFields.centerName = centerCandidate;
      if (!baseFields.center) baseFields.center = centerCandidate;
      if (!baseFields.organization) baseFields.organization = centerCandidate;
    }

    const raw = currentResult?.raw || null;
    const confidence = Math.max(
      typeof currentResult?.confidence === 'number' ? currentResult.confidence : 0,
      detection?.confidence || 0.5
    );

    if (detectedIntent === 'create_contact') {
      if (!baseFields.contactType && detection?.meta?.contactRegion) {
        baseFields.contactType = detection.meta.contactRegion;
      }
      return {
        intent: 'create_contact',
        confidence,
        fields: baseFields,
        response: centerCandidate
          ? 'درخواست ثبت تماس شما به صورت کمکی شناسایی شد.'
          : 'درخواست تماس تشخیص داده شد اما نام مرکز مشخص نیست.',
        followUpQuestion: null,
        heuristic: true,
        raw
      };
    }

    if (detectedIntent === 'medical_request') {
      return {
        intent: 'medical_request',
        confidence,
        fields: baseFields,
        response: 'درخواست تاییدیه پزشکی تشخیص داده شد. در حال حاضر برای ثبت/آپلود تاییدیه از منوی 🏥 تاییدیه‌ها استفاده کنید.',
        followUpQuestion: null,
        heuristic: true,
        raw
      };
    }

    if (detectedIntent === 'request_report') {
      return {
        intent: 'request_report',
        confidence,
        fields: baseFields,
        response: 'درخواست گزارش تشخیص داده شد.',
        followUpQuestion: null,
        heuristic: true,
        raw
      };
    }

    if (detectedIntent === 'request_leave') {
      return {
        intent: 'request_leave',
        confidence,
        fields: baseFields,
        response: 'درخواست مرخصی تشخیص داده شد.',
        followUpQuestion: null,
        heuristic: true,
        raw
      };
    }

    if (detectedIntent === 'center_info') {
      return {
        intent: 'center_info',
        confidence,
        fields: baseFields,
        response: 'برای مشاهده یا ویرایش اطلاعات مراکز می‌توانید از منوی "📝 تکمیل اطلاعات مرکز" یا گزینه‌های مرتبط استفاده کنید.',
        followUpQuestion: null,
        heuristic: true,
        raw
      };
    }

    // Default to assignment when nothing else matched
    return {
      intent: 'create_assignment',
      confidence,
      fields: baseFields,
      response: centerCandidate
        ? 'درخواست ماموریت شما به صورت کمکی تشخیص داده شد.'
        : 'درخواست ماموریت تشخیص داده شد اما نام مرکز مشخص نیست.',
      followUpQuestion: centerCandidate ? null : 'نام دقیق مرکز را ذکر می‌کنید؟',
      heuristic: true,
      raw
    };
  }

  normalizeTextForHeuristic(text = '') {
    return text.replace(/\s+/g, ' ').trim();
  }

  normalizeCenterName(name = '') {
    if (!name || typeof name !== 'string') return '';
    
    // حذف کلمات اضافی
    const stopWords = [
      'بیمارستان', 'مرکز', 'مجموعه', 'کلینیک', 'درمانگاه', 'مطب',
      'hospital', 'center', 'clinic', 'medical', 'center',
      'برای', 'که', 'دارم', 'داریم', 'می', 'میرم', 'می‌روم', 'می‌رم',
      'میخوام', 'می‌خوام', 'جهت', 'تا', 'از', 'ایجاد', 'ثبت', 'بابت', 'روی'
    ];
    
    let normalized = name.trim();
    
    // حذف stop words از ابتدا و انتها
    for (const stopWord of stopWords) {
      const regex = new RegExp(`^${stopWord}\\s+|\\s+${stopWord}$`, 'gi');
      normalized = normalized.replace(regex, ' ').trim();
    }
    
    // نرمال‌سازی فاصله‌ها
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized.slice(0, 100);
  }

  extractCenterNameFromText(text = '') {
    if (!text) {
      return '';
    }

    const flattened = text.replace(/\s+/g, ' ').trim();
    if (!flattened) {
      return '';
    }

    // الگوهای بهبود یافته برای استخراج نام مرکز
    const patterns = [
      // الگوی "در/به [نام مرکز]"
      /(?:در|به)\s+(?:مجموعه\s+)?(?:بیمارستان\s+)?(?:مرکز\s+)?([آ-یA-Za-z0-9‌\-\s]+?)(?=\s+(?:برای|که|دارم|داریم|دارید|دارین|می|میرم|می‌روم|می‌رم|میخوام|می‌خوام|جهت|تا|از|ایجاد|ثبت|بابت|روی|امروز|،|,|$))/i,
      // الگوی "بیمارستان [نام]"
      /(?:بیمارستان(?:‌|\s)+)([آ-یA-Za-z0-9‌\-\s]+?)(?=\s+(?:برای|که|دارم|داریم|دارید|می|میرم|می‌روم|می‌رم|میخوام|می‌خوام|جهت|تا|از|ایجاد|ثبت|بابت|روی|امروز|،|,|$))/i,
      // الگوی "مرکز [نام]"
      /(?:مرکز(?:‌|\s)+)([آ-یA-Za-z0-9‌\-\s]+?)(?=\s+(?:برای|که|دارم|داریم|دارید|می|میرم|می‌روم|می‌رم|میخوام|می‌خوام|جهت|تا|از|ایجاد|ثبت|بابت|روی|امروز|،|,|$))/i,
      // الگوی مستقیم: اگر فقط یک کلمه یا چند کلمه بدون فعل باشد
      /^([آ-یA-Za-z0-9‌\-\s]{2,50})(?=\s*(?:برای|که|دارم|داریم|دارید|می|میرم|می‌روم|می‌رم|میخوام|می‌خوام|جهت|تا|از|ایجاد|ثبت|بابت|روی|امروز|،|,|$))/i
    ];

    for (const pattern of patterns) {
      const match = flattened.match(pattern);
      if (match && match[1]) {
        const candidate = this.normalizeCenterName(match[1]);
        if (candidate && candidate.length >= 2) {
          return candidate;
        }
      }
    }

    // اگر هیچ الگویی کار نکرد، سعی کن کل متن را برگردان (اگر کوتاه باشد)
    if (flattened.length <= 50 && !/(برای|که|دارم|می|میرم|میخوام|ایجاد|ثبت)/i.test(flattened)) {
      return this.normalizeCenterName(flattened);
    }

    return '';
  }

  extractCenterNamesList(fields = {}, originalInput = '') {
    // اول centerCandidates از AI را چک کن
    if (Array.isArray(fields.centerCandidates) && fields.centerCandidates.length > 1) {
      const normalized = fields.centerCandidates
        .map(c => this.normalizeCenterName(c))
        .filter(c => c && c.length >= 2);
      if (normalized.length > 1) {
        return normalized;
      }
    }

    const candidates = [];
    if (fields.centerName) {
      candidates.push(fields.centerName);
    }
    if (fields.notes) {
      candidates.push(fields.notes);
    }
    if (!fields.centerName && originalInput) {
      candidates.push(originalInput);
    }

    const names = new Set();
    let hasSplitted = false;
    const splitter = /[\n،,؛\/]+|(?:\s+و\s+)/g;

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'string') continue;
      const trimmedCandidate = candidate.trim();
      if (!trimmedCandidate) continue;

      const parts = trimmedCandidate.split(splitter)
        .map(part => this.normalizeCenterName(part))
        .filter(part => part && part.length >= 2 && !/^(ثبت|تماس|مرکز|مراکز|برای|سه|3|دو|یک)$/i.test(part));

      if (parts.length > 1) {
        hasSplitted = true;
        parts.forEach(part => names.add(part));
      }
    }

    if (!hasSplitted) {
      return [];
    }

    return Array.from(names);
  }

  detectHeuristicIntent(text = '') {
    if (!text) {
      return null;
    }
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();

    const contactRegex = /(تماس|call|پیگیری|زنگ|گزارش تماس|follow up|follow-up|پیگیری تلفنی|مکالمه)/;
    const missionRegex = /(ماموریت|مأموریت|mission|ویزیت|visit|حضور|حضوری|اعزام|بازدید|snap|snapp)/;
    const leaveRegex = /(مرخصی|استعلاجی|ساعتی|leave|مرخص)/;
    const reportRegex = /(گزارش|report|آمار|کارکرد|تحلیل)/;
    const medicalRegex = /(تاییدیه|پزشکی|medical|نسخه|آزمایش|آپلود|گواهی|پزشک|دکتر|اسکن|مدیکال)/;
    const centerInfoRegex = /(اطلاعات مرکز|اطلاعات مراکز|جزییات مرکز|پروفایل مرکز|لیست مراکز|center info|center information)/;

    if (contactRegex.test(normalized)) {
      const region = this.detectContactRegionFromText(normalized);
      return {
        intent: 'create_contact',
        confidence: region ? 0.85 : 0.7,
        meta: { contactRegion: region }
      };
    }

    if (medicalRegex.test(normalized)) {
      return { intent: 'medical_request', confidence: 0.75 };
    }

    if (leaveRegex.test(normalized)) {
      return { intent: 'request_leave', confidence: 0.7 };
    }

    if (reportRegex.test(normalized)) {
      return { intent: 'request_report', confidence: 0.65 };
    }

    if (centerInfoRegex.test(normalized)) {
      return { intent: 'center_info', confidence: 0.7 };
    }

    if (missionRegex.test(normalized)) {
      return { intent: 'create_assignment', confidence: 0.6 };
    }

    return null;
  }

  detectContactRegionFromText(text = '') {
    if (!text) {
      return null;
    }
    const normalized = text.toLowerCase();
    if (/(تهران|teران|tehran|پایتخت|مرکز)/.test(normalized)) {
      return 'tehran';
    }
    if (this.containsProvinceKeyword(normalized)) {
      return 'province';
    }
    return null;
  }

  containsProvinceKeyword(text = '') {
    if (!text) {
      return false;
    }
    const normalized = text.toLowerCase();
    return PROVINCE_KEYWORDS.some(keyword => {
      const key = keyword.toLowerCase();
      return key && normalized.includes(key);
    });
  }

  async ensureAiCenterSelection(fields = {}, context = {}, originalInput = '', intent = '') {
    try {
      const center = await this.resolveCenterFromFields(fields);
      if (center) {
        return { center };
      }

      const chatId = context?.chatId;
      const searchTerm = this.extractCenterSearchTerm(fields);
      if (!searchTerm) {
        return {
          errorMessage: '⚠️ نام مرکز مشخص نیست. لطفاً نام دقیق مرکز را بگویید.'
        };
      }

      if (!chatId) {
        return {
          errorMessage: '⚠️ امکان درخواست انتخاب مرکز وجود ندارد. لطفاً دوباره تلاش کنید.'
        };
      }

      const suggestions = await this.findCenterSuggestions(
        searchTerm,
        fields.centerCity || fields.city,
        6
      );

      await this.promptAiCenterSelection(chatId, {
        intent,
        fields,
        context,
        originalInput,
        searchTerm,
        suggestions,
        cityHint: fields.centerCity || fields.city
      });

      return { pendingSelection: true };
    } catch (error) {
      console.error('[AI] Failed in ensureAiCenterSelection:', error);
      return {
        errorMessage: '❌ خطا در جستجوی مرکز. لطفاً دوباره تلاش کنید.'
      };
    }
  }

  // محاسبه شباهت بین دو رشته با الگوریتم Levenshtein ساده
  calculateSimilarity(str1 = '', str2 = '') {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // محاسبه طول مشترک
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    // محاسبه تعداد کاراکترهای مشترک
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    const similarity = matches / longer.length;
    return similarity;
  }

  // محاسبه امتیاز برای یک مرکز بر اساس جستجو
  scoreCenterMatch(center, searchTerm = '', cityHint = '') {
    if (!center || !searchTerm) return 0;
    
    const normalizedSearch = this.normalizeCenterName(searchTerm).toLowerCase();
    const centerName = (center.name || '').toLowerCase();
    const centerCity = (center.city || '').toLowerCase();
    const centerProvince = (center.province || '').toLowerCase();
    const centerAddress = (center.address || '').toLowerCase();
    
    let score = 0;
    
    // امتیاز برای تطابق دقیق نام
    if (centerName === normalizedSearch) {
      score += 100;
    } else if (centerName.startsWith(normalizedSearch)) {
      score += 80;
    } else if (centerName.includes(normalizedSearch)) {
      score += 60;
    } else {
      // محاسبه شباهت fuzzy
      const similarity = this.calculateSimilarity(normalizedSearch, centerName);
      score += similarity * 40;
    }
    
    // امتیاز برای تطابق شهر
    if (cityHint) {
      const normalizedCity = cityHint.trim().toLowerCase();
      if (centerCity === normalizedCity) {
        score += 30;
      } else if (centerCity.includes(normalizedCity) || normalizedCity.includes(centerCity)) {
        score += 15;
      }
    }
    
    // امتیاز برای تطابق در آدرس
    if (centerAddress.includes(normalizedSearch)) {
      score += 10;
    }
    
    // امتیاز برای تطابق در استان
    if (centerProvince.includes(normalizedSearch)) {
      score += 5;
    }
    
    // امتیاز اضافی برای مراکز فعال
    if (center.isActive) {
      score += 5;
    }
    
    return score;
  }

  async findCenterSuggestions(searchTerm, cityHint = '', limit = 5) {
    if (!searchTerm) {
      return [];
    }

    try {
      const normalizedSearch = this.normalizeCenterName(searchTerm);
      if (!normalizedSearch || normalizedSearch.length < 2) {
        return [];
      }

      // ابتدا جستجوی اولیه با LIKE
      const initialCandidates = await Center.getAll({
        isActive: true,
        search: normalizedSearch,
        limit: 50 // بیشتر بگیریم تا بعداً فیلتر کنیم
      });

      if (!Array.isArray(initialCandidates) || !initialCandidates.length) {
        // اگر با LIKE چیزی پیدا نشد، همه مراکز فعال را بگیر و fuzzy search کن
        const allActive = await Center.getAll({
          isActive: true,
          limit: 200
        });
        
        if (!Array.isArray(allActive) || !allActive.length) {
          return [];
        }
        
        // امتیازدهی و مرتب‌سازی
        const scored = allActive.map(center => ({
          center,
          score: this.scoreCenterMatch(center, normalizedSearch, cityHint)
        }))
        .filter(item => item.score > 20) // فقط نتایج با امتیاز بالای 20
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.center);
        
        return scored;
      }

      // امتیازدهی و مرتب‌سازی نتایج
      const scored = initialCandidates.map(center => ({
        center,
        score: this.scoreCenterMatch(center, normalizedSearch, cityHint)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.center);

      return scored;
    } catch (error) {
      console.error('[AI] Failed to load center suggestions:', error);
      return [];
    }
  }

  async promptAiCenterSelection(chatId, params = {}) {
    try {
      const {
        intent = '',
        fields = {},
        context = {},
        originalInput = '',
        searchTerm,
        suggestions,
        cityHint,
        multiContext = null
      } = params;

      const cleanTerm = (searchTerm || this.extractCenterSearchTerm(fields) || '').trim();
      if (!cleanTerm) {
        await this.bot.sendMessage(chatId, '⚠️ نام مرکز مشخص نیست. لطفاً نام دقیق مرکز را تایپ کنید.');
        return false;
      }

      let centerSuggestions = Array.isArray(suggestions) ? suggestions : [];
      if (!centerSuggestions.length) {
        centerSuggestions = await this.findCenterSuggestions(
          cleanTerm,
          cityHint || fields.centerCity || fields.city,
          6
        );
      }

      const hasSuggestions = centerSuggestions.length > 0;

      const inlineKeyboard = hasSuggestions
        ? centerSuggestions.map(center => ([
            {
              text: `${center.name}${center.city ? ` • ${center.city}` : ''}`,
              callback_data: `ai_select_center_${center.id}`
            }
          ]))
        : [];

      inlineKeyboard.push([
        { text: '📚 جستجوی مراکز', callback_data: 'ai_center_open_search' }
      ]);

      inlineKeyboard.push([
        { text: '🔄 نام دیگر', callback_data: 'ai_center_retry' },
        { text: '❌ لغو', callback_data: 'ai_center_cancel' }
      ]);

      this.conversations.delete(chatId);
      this.conversations.set(chatId, {
        type: 'ai_center_selection',
        createdAt: Date.now(),
        data: {
          intent,
          fields: this.cloneSimpleObject(fields),
          context: this.cloneSimpleObject(context),
          originalInput,
          searchTerm: cleanTerm,
          suggestionIds: centerSuggestions.map(c => c.id),
          cityHint: cityHint || fields.centerCity || fields.city || '',
          allowManualOnly: !hasSuggestions,
          multiContext
        }
      });

      let message;
      if (hasSuggestions) {
        const suggestionCount = centerSuggestions.length;
        message =
          `🔍 *جستجوی هوشمند مراکز*\n\n` +
          `برای "${cleanTerm}" ${suggestionCount} مرکز مشابه پیدا شد:\n\n` +
          `لطفاً مرکز مورد نظر را از لیست زیر انتخاب کنید:`;
      } else {
        message =
          `❌ *هیچ مرکزی با نام "${cleanTerm}" پیدا نشد.*\n\n` +
          `💡 *پیشنهادها:*\n` +
          `• از دکمه "📚 جستجوی مراکز" برای جستجوی پیشرفته استفاده کنید\n` +
          `• نام دقیق‌تر مرکز را تایپ کنید\n` +
          `• از دکمه "🔄 نام دیگر" برای جستجوی مجدد استفاده کنید`;
      }

      await this.bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: inlineKeyboard
        },
        parse_mode: 'Markdown'
      });

      return true;
    } catch (error) {
      console.error('[AI] Failed to prompt AI center selection:', error);
      await this.bot.sendMessage(chatId, '❌ خطا در نمایش لیست مراکز. لطفاً دوباره تلاش کنید.');
      return false;
    }
  }

  async handleAiCenterCallback(query) {
    const data = query.data;
    if (!data) {
      return false;
    }

    const chatId = query.message.chat.id;

    if (data === 'ai_center_cancel') {
      await this.cancelAiCenterSelection(chatId);
      return true;
    }

    if (data === 'ai_center_retry') {
      await this.promptAiCenterRetry(chatId);
      return true;
    }

    if (data === 'ai_center_open_search') {
      await this.openAiCenterSearch(chatId);
      return true;
    }

    if (data === 'ai_center_search_prompt') {
      await this.promptAiCenterSearchInput(chatId);
      return true;
    }

    if (data === 'ai_center_search_back') {
      await this.returnFromAiCenterSearch(chatId);
      return true;
    }

    if (data.startsWith('ai_center_search_page_')) {
      const page = parseInt(data.replace('ai_center_search_page_', ''), 10);
      if (!Number.isNaN(page)) {
        await this.updateAiCenterSearchPage(chatId, page);
      }
      return true;
    }

    if (data.startsWith('ai_center_search_select_')) {
      const centerId = parseInt(data.replace('ai_center_search_select_', ''), 10);
      if (Number.isNaN(centerId)) {
        await this.bot.sendMessage(chatId, '❌ شناسه مرکز معتبر نیست. لطفاً دوباره تلاش کنید.');
        return true;
      }
      await this.completeAiCenterSelection(chatId, centerId);
      return true;
    }

    if (data.startsWith('ai_select_center_')) {
      const centerId = parseInt(data.replace('ai_select_center_', ''), 10);
      if (Number.isNaN(centerId)) {
        await this.bot.sendMessage(chatId, '❌ شناسه مرکز معتبر نیست. لطفاً دوباره تلاش کنید.');
        return true;
      }
      await this.completeAiCenterSelection(chatId, centerId);
      return true;
    }

    return false;
  }

  async handleAiContactRegionCallback(query) {
    const data = query.data;
    if (!data || !data.startsWith('ai_contact_region_')) {
      return false;
    }

    const chatId = query.message.chat.id;
    if (data === 'ai_contact_region_cancel') {
      if (this.conversations.get(chatId)?.type === 'ai_contact_region') {
        this.conversations.delete(chatId);
      }
      await this.bot.sendMessage(chatId, '❌ ثبت تماس لغو شد. می‌توانید دوباره دستور جدیدی ارسال کنید.');
      return true;
    }

    const selection = data.replace('ai_contact_region_', '');
    if (selection === 'tehran' || selection === 'province') {
      await this.resumeAiContactAfterRegion(chatId, selection);
      return true;
    }

    return true;
  }

  async handleAiContactRegionText(msg, conversation) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (this.isCancelCommand(text)) {
      this.conversations.delete(chatId);
      await this.bot.sendMessage(chatId, '❌ ثبت تماس لغو شد. می‌توانید دوباره دستور جدیدی ارسال کنید.');
      return;
    }

    const selection = this.interpretContactRegionFromText(text);
    if (!selection) {
      await this.bot.sendMessage(chatId, 'لطفاً مشخص کنید تماس تهران بود یا استان (مثلاً بنویسید "تهران" یا "استان").');
      return;
    }

    await this.resumeAiContactAfterRegion(chatId, selection);
  }

  async resumeAiContactAfterRegion(chatId, region) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.type !== 'ai_contact_region') {
      await this.bot.sendMessage(chatId, '⌛ انتخاب نوع تماس منقضی شده است. لطفاً دوباره تلاش کنید.');
      return;
    }

    this.conversations.delete(chatId);
    const payload = conversation.data || {};
    const fields = this.cloneSimpleObject(payload.fields || {});
    fields.contactType = region;

    try {
      const result = await this.handleAiIntentCreateContact(
        fields,
        payload.context || {},
        payload.originalInput || '',
        chatId
      );
      if (result?.message) {
        await this.bot.sendMessage(chatId, result.message);
      }
    } catch (error) {
      console.error('[AI] Failed to resume contact flow after region selection:', error);
      await this.bot.sendMessage(chatId, '❌ خطا در ثبت تماس. لطفاً دوباره تلاش کنید.');
    }
  }

  interpretContactRegionFromText(text = '') {
    const region = this.detectContactRegionFromText(text);
    return region;
  }

  async handleAiMedicalRequest(chatId, context = {}, fields = {}, originalInput = '') {
    const telegramId =
      context.telegramId ||
      context.personnel?.telegramId ||
      null;
    
    const personnel = context.personnel || (telegramId ? await this.getPersonnelByTelegramId(telegramId) : null);
    if (!personnel) {
      await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
      return;
    }

    // شروع فلو آپلود با داده‌های استخراج‌شده
    this.conversations.set(chatId, {
      step: 'medical_upload_wait_file',
      telegramId,
      data: {
        personnelId: personnel.id,
        // اطلاعات استخراج‌شده از AI
        aiExtracted: {
          centerName: fields.centerName || fields.center || null,
          doctorName: fields.doctorName || fields.doctor || null,
          specialty: fields.specialty || fields.doctorSpecialty || null,
          province: fields.province || fields.city || null,
          description: fields.description || fields.notes || originalInput || null,
          brand: fields.brand || null,
          product: fields.product || null
        }
      }
    });

    await this.bot.sendMessage(
      chatId,
      '📤 *آپلود تاییدیه*\n\n' +
      '✅ اطلاعات زیر از پیام شما استخراج شد:\n' +
      (fields.centerName ? `🏢 مرکز: ${fields.centerName}\n` : '') +
      (fields.doctorName ? `👨‍⚕️ پزشک: ${fields.doctorName}\n` : '') +
      (fields.specialty ? `🩺 تخصص: ${fields.specialty}\n` : '') +
      (fields.province ? `📍 استان: ${fields.province}\n` : '') +
      (fields.description || originalInput ? `📝 توضیحات: ${fields.description || originalInput}\n` : '') +
      '\n' +
      'لطفاً فایل تاییدیه (pdf یا عکس) را ارسال کنید.',
      {
        ...this.buildMedicalUploadCancelKeyboard(),
        parse_mode: 'Markdown'
      }
    );
  }

  async handleAiCenterManualInput(msg, conversation) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (!conversation || conversation.type !== 'ai_center_selection') {
      await this.bot.sendMessage(chatId, '⌛ انتخاب مرکز فعال نیست. لطفاً دوباره تلاش کنید.');
      return;
    }

    if (this.isCancelCommand(text)) {
      await this.cancelAiCenterSelection(chatId);
      return;
    }

    if (!text) {
      await this.bot.sendMessage(chatId, '✍️ لطفاً نام مرکز را وارد کنید یا از دکمه لغو استفاده کنید.');
      return;
    }

    const data = conversation?.data || {};
    data.fields = data.fields || {};
    data.fields.centerName = text;
    data.fields.center = text;
    data.fields.organization = text;

    await this.promptAiCenterSelection(chatId, {
      intent: data.intent,
      fields: data.fields,
      context: data.context,
      originalInput: data.originalInput,
      searchTerm: text,
      cityHint: data.cityHint
    });
  }

  async promptAiContactRegion(chatId, payload = {}) {
    try {
      if (!chatId) return;
      this.conversations.set(chatId, {
        type: 'ai_contact_region',
        createdAt: Date.now(),
        data: {
          fields: this.cloneSimpleObject(payload.fields || {}),
          context: this.cloneSimpleObject(payload.context || {}),
          originalInput: payload.originalInput || ''
        }
      });

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '☎️ تماس تهران', callback_data: 'ai_contact_region_tehran' }],
            [{ text: '🌐 تماس استان', callback_data: 'ai_contact_region_province' }],
            [{ text: '❌ لغو', callback_data: 'ai_contact_region_cancel' }]
          ]
        }
      };

      await this.bot.sendMessage(chatId,
        '📞 تماس مربوط به تهران بود یا استان؟',
        keyboard
      );
    } catch (error) {
      console.error('[AI] Failed to prompt contact region:', error);
      await this.bot.sendMessage(chatId, '❌ خطا در دریافت نوع تماس. لطفاً دوباره تلاش کنید.');
    }
  }

  async openAiCenterSearch(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.type !== 'ai_center_selection') {
      await this.bot.sendMessage(chatId, '⌛ انتخاب مرکز فعال نیست. لطفاً دوباره تلاش کنید.');
      return;
    }
    await this.startAiCenterSearchFlow(chatId, conversation.data);
  }

  async startAiCenterSearchFlow(chatId, selectionData = {}, initialSearch = '') {
    const payload = this.cloneSimpleObject(selectionData || {});
    const searchQuery = initialSearch || payload.searchTerm || '';
    this.conversations.set(chatId, {
      type: 'ai_center_search',
      createdAt: Date.now(),
      data: {
        selectionData: payload,
        searchQuery,
        page: 0,
        awaitingSearchInput: false
      }
    });
    await this.renderAiCenterSearchList(chatId);
  }

  async promptAiCenterSearchInput(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.type !== 'ai_center_search') {
      await this.openAiCenterSearch(chatId);
      return;
    }
    conversation.data.awaitingSearchInput = true;
    this.conversations.set(chatId, conversation);
    await this.bot.sendMessage(chatId, '📝 لطفاً عبارت جستجوی مرکز را تایپ کنید.');
  }

  async updateAiCenterSearchPage(chatId, page) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.type !== 'ai_center_search') {
      await this.openAiCenterSearch(chatId);
      return;
    }
    conversation.data.page = Math.max(0, page);
    conversation.data.awaitingSearchInput = false;
    this.conversations.set(chatId, conversation);
    await this.renderAiCenterSearchList(chatId);
  }

  async returnFromAiCenterSearch(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.type !== 'ai_center_search') {
      await this.bot.sendMessage(chatId, '⌛ انتخاب فعالی وجود ندارد.');
      return;
    }
    const selectionData = conversation.data?.selectionData;
    if (!selectionData) {
      await this.cancelAiCenterSelection(chatId);
      return;
    }
    await this.promptAiCenterSelection(chatId, selectionData);
  }

  async renderAiCenterSearchList(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || conversation.type !== 'ai_center_search') {
      await this.openAiCenterSearch(chatId);
      return;
    }

    const searchQuery = (conversation.data?.searchQuery || '').trim();
    const filters = {};
    if (searchQuery) {
      filters.search = searchQuery;
    }

    let centers = [];
    try {
      centers = await Center.getAll(filters);
    } catch (error) {
      console.error('[AI] Failed to load centers for search:', error);
    }
    centers = Array.isArray(centers) ? centers : [];

    const centersPerPage = 8;

    if (!centers.length) {
      const inlineKeyboard = [
        [{ text: '🔍 تغییر جستجو', callback_data: 'ai_center_search_prompt' }],
        [{ text: '↩️ بازگشت به پیشنهادها', callback_data: 'ai_center_search_back' }],
        [{ text: '❌ لغو', callback_data: 'ai_center_cancel' }]
      ];

      const message = searchQuery
        ? `❌ هیچ مرکزی با جستجوی "${searchQuery}" یافت نشد.\n✨ نام دیگری وارد کنید یا دکمه بازگشت را بزنید.`
        : '❌ هیچ مرکزی برای نمایش وجود ندارد.\n✨ نام مرکز را وارد کنید یا از دکمه بازگشت استفاده کنید.';

      await this.bot.sendMessage(chatId, message, {
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
      return;
    }

    const totalPages = Math.max(1, Math.ceil(centers.length / centersPerPage));
    const currentPage = Math.min(
      Math.max(conversation.data?.page || 0, 0),
      totalPages - 1
    );
    conversation.data.page = currentPage;
    conversation.data.awaitingSearchInput = false;
    this.conversations.set(chatId, conversation);

    const centersToShow = centers.slice(
      currentPage * centersPerPage,
      (currentPage + 1) * centersPerPage
    );

    const inlineKeyboard = centersToShow.map(center => ([
      {
        text: `${center.name}${center.city ? ` • ${center.city}` : ''}`,
        callback_data: `ai_center_search_select_${center.id}`
      }
    ]));

    if (totalPages > 1) {
      const navRow = [];
      if (currentPage > 0) {
        navRow.push({ text: '⬅️ قبلی', callback_data: `ai_center_search_page_${currentPage - 1}` });
      }
      if (currentPage < totalPages - 1) {
        navRow.push({ text: '➡️ بعدی', callback_data: `ai_center_search_page_${currentPage + 1}` });
      }
      inlineKeyboard.push(navRow);
    }

    inlineKeyboard.push([{ text: '🔍 تغییر جستجو', callback_data: 'ai_center_search_prompt' }]);
    inlineKeyboard.push([
      { text: '↩️ بازگشت به پیشنهادها', callback_data: 'ai_center_search_back' },
      { text: '❌ لغو', callback_data: 'ai_center_cancel' }
    ]);

    let message = `📚 جستجوی مراکز\n`;
    if (searchQuery) {
      message += `🔍 جستجو: "${searchQuery}"\n`;
    } else {
      message += '🔎 در حال نمایش مراکز بدون فیلتر جستجو\n';
    }
    message += `📄 صفحه ${currentPage + 1} از ${totalPages}\n`;
    message += `لطفاً مرکز مورد نظر را انتخاب کنید یا جستجو را تغییر دهید.`;

    await this.bot.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  async handleAiCenterSearchText(msg, conversation) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (this.isCancelCommand(text)) {
      await this.cancelAiCenterSelection(chatId);
      return;
    }

    if (!text) {
      await this.bot.sendMessage(chatId, '✍️ لطفاً متن جستجو را وارد کنید.');
      return;
    }

    conversation.data.searchQuery = text;
    conversation.data.page = 0;
    conversation.data.awaitingSearchInput = false;
    this.conversations.set(chatId, conversation);
    await this.renderAiCenterSearchList(chatId);
  }

  async completeAiCenterSelection(chatId, centerId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation || (conversation.type !== 'ai_center_selection' && conversation.type !== 'ai_center_search')) {
      await this.bot.sendMessage(chatId, '⌛ انتخاب مرکز منقضی شده است. لطفاً دوباره تلاش کنید.');
      return;
    }

    const selectionData = conversation.data?.selectionData || conversation.data || {};
    const multiContext = selectionData?.multiContext || conversation.data?.multiContext || null;
    this.conversations.delete(chatId);

    try {
      const center = await Center.getById(centerId);
      if (!center) {
        await this.bot.sendMessage(chatId, '❌ مرکز انتخاب شده یافت نشد. لطفاً گزینه دیگری را انتخاب کنید.');
        if (multiContext?.type === 'ai_contact_multi') {
          await this.handleMultiContactAfterSelection(chatId, multiContext, null);
        }
        return;
      }

      const {
        intent,
        fields = {},
        context = {},
        originalInput = ''
      } = selectionData;
      const updatedFields = {
        ...(fields || {}),
        centerId: center.id,
        centerName: center.name,
        centerCity: center.city
      };

      let actionResult = null;
      if (intent === 'create_contact' || intent === 'create_contact_multi') {
        actionResult = await this.handleAiIntentCreateContact(updatedFields, context, originalInput, chatId);
      } else if (intent === 'create_assignment') {
        actionResult = await this.handleAiIntentCreateAssignment(updatedFields, context, originalInput);
      } else {
        await this.bot.sendMessage(chatId, '⚠️ عملیات انتخاب مرکز ناشناخته است.');
        return;
      }

      if (multiContext?.type === 'ai_contact_multi') {
        await this.handleMultiContactAfterSelection(chatId, multiContext, actionResult);
        return;
      }

      const responseParts = [
        `✅ مرکز "${center.name}" انتخاب شد.`
      ];

      if (actionResult?.message) {
        responseParts.push(actionResult.message);
      }

      await this.bot.sendMessage(chatId, responseParts.join('\n\n'));
    } catch (error) {
      console.error('[AI] Failed to complete center selection:', error);
      await this.bot.sendMessage(chatId, '❌ خطا در انتخاب مرکز. لطفاً دوباره تلاش کنید.');
    }
  }

  async cancelAiCenterSelection(chatId) {
    const conversation = this.conversations.get(chatId);
    if (conversation && (conversation.type === 'ai_center_selection' || conversation.type === 'ai_center_search')) {
      this.conversations.delete(chatId);
    }
    await this.bot.sendMessage(chatId, '❌ انتخاب مرکز لغو شد. می‌توانید دوباره دستور جدیدی ارسال کنید.');
  }

  async promptAiCenterRetry(chatId) {
    const conversation = this.conversations.get(chatId);
    if (!conversation) {
      await this.bot.sendMessage(chatId, '⌛ انتخاب فعالی وجود ندارد. ابتدا درخواست جدیدی ارسال کنید.');
      return;
    }

    if (conversation.type === 'ai_center_search') {
      await this.promptAiCenterSearchInput(chatId);
      return;
    }

    if (conversation.type === 'ai_center_selection') {
      await this.bot.sendMessage(chatId, '📝 لطفاً نام دقیق مرکز مورد نظر را تایپ کنید.');
      return;
    }

    await this.bot.sendMessage(chatId, '⌛ انتخاب فعالی وجود ندارد. ابتدا درخواست جدیدی ارسال کنید.');
  }

  determineContactType(fields = {}, center = null) {
    const normalized = this.normalizeContactTypeValue(fields.contactType);
    if (normalized) {
      return normalized;
    }

    const city =
      (fields.city || fields.centerCity || center?.city || '')
        .toLowerCase()
        .trim();
    if (city.includes('تهران') || city.includes('tehran')) {
      return 'tehran';
    }
    if (city && this.containsProvinceKeyword(city)) {
      return 'province';
    }

    return null;
  }

  normalizeContactTypeValue(value) {
    if (!value) {
      return null;
    }
    const normalized = String(value).toLowerCase();
    if (['tehran', 'تهران', 'تهرانی', 'شهر', 'urban'].some(keyword => normalized.includes(keyword))) {
      return 'tehran';
    }
    if (['province', 'استان', 'شهرستان', 'برون', 'خارج از تهران', 'شهر', 'county'].some(keyword => normalized.includes(keyword))) {
      return 'province';
    }
    return null;
  }

  buildContactNotes(fields = {}, originalInput = '') {
    const parts = [];
    if (fields.notes) {
      parts.push(fields.notes);
    }
    if (fields.summary) {
      parts.push(`خلاصه: ${fields.summary}`);
    }
    if (fields.details) {
      parts.push(`جزئیات: ${fields.details}`);
    }
    if (fields.date) {
      parts.push(`تاریخ مدنظر: ${fields.date}`);
    }
    if (fields.result || fields.outcome) {
      parts.push(`نتیجه تماس: ${fields.result || fields.outcome}`);
    }
    if (!parts.length && originalInput) {
      parts.push(originalInput);
    } else if (originalInput) {
      parts.push(`متن اولیه: ${originalInput}`);
    }
    return parts.join('\n');
  }

  async getPersonnelByTelegramId(telegramId) {
    if (!telegramId) {
      return null;
    }
    try {
      const personnel = await Personnel.getByTelegramId(telegramId.toString());
      return personnel || null;
    } catch (error) {
      console.error('[AI] Failed to load personnel by telegram ID:', error);
      return null;
    }
  }

  formatFieldsForDisplay(fields = {}) {
    const entries = Object.entries(fields || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '');

    if (!entries.length) {
      return '';
    }

    return entries
      .map(([key, value]) => {
        const normalizedKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .trim();
        const prettyKey = normalizedKey.charAt(0).toUpperCase() + normalizedKey.slice(1);
        return `• ${prettyKey}: ${value}`;
      })
      .join('\n');
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  formatHrNumber(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('fa-IR', { maximumFractionDigits: 1 });
  }

  formatCurrencyValue(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('fa-IR', { maximumFractionDigits: 0 });
  }

  normalizeDigits(value = '') {
    const map = {
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
      '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    return value.replace(/[۰-۹]/g, (d) => map[d] || d);
  }

  isCancelCommand(text) {
    if (!text) return false;
    const normalized = text.toLowerCase();
    return normalized === '/cancel' ||
      normalized === 'cancel' ||
      normalized === 'لغو' ||
      normalized === 'انصراف';
  }

  isLikelyAiIntentText(text = '') {
    if (!text) return false;
    const normalized = text.trim();
    if (!normalized) {
      return false;
    }
    const lower = normalized.toLowerCase();
    const keywords = [
      'ماموریت', 'مأموریت', 'مرخصی', 'گزارش', 'تماس', 'ثبت', 'درخواست',
      'leave', 'mission', 'report', 'contact', 'medical', 'تایید', 'تاییدیه',
      'اطلاعات مرکز', 'اطلاعات مراکز', 'ویزیت', 'حضوری'
    ];
    return keywords.some(keyword => lower.includes(keyword));
  }

  parseAiDate(value) {
    if (!value) return null;
    const normalizedDigits = this.normalizeDigits(String(value));
    let normalized = normalizedDigits
      .replace(/[\.\/]/g, '-')
      .replace(/تا|الی/gi, '-')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();

    if (/^\d{8}$/.test(normalized)) {
      normalized = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6)}`;
    }

    return this.parseDateInput(normalized);
  }

  parseAiTime(value) {
    if (!value) return null;
    const normalizedDigits = this.normalizeDigits(String(value));
    let normalized = normalizedDigits
      .replace('.', ':')
      .replace(/\s+/g, '')
      .trim();

    if (/^\d{4}$/.test(normalized)) {
      normalized = `${normalized.slice(0, 2)}:${normalized.slice(2)}`;
    }

    return this.parseTimeInput(normalized);
  }

  parseDateInput(input) {
    if (!input) return null;
    const normalized = input.replace(/[\/\.]/g, '-');
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) {
      return null;
    }
    let year = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let day = parseInt(match[3], 10);

    if (year >= 1300 && year < 1500) {
      const g = toGregorian(year, month, day);
      year = g.gy;
      month = g.gm;
      day = g.gd;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  parseTimeInput(input) {
    if (!input) return null;
    const match = input.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return null;
    }
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  calculateDaysCount(startDate, endDate) {
    try {
      const start = new Date(`${startDate}T00:00:00Z`);
      const end = new Date(`${endDate}T00:00:00Z`);
      const diff = end.getTime() - start.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
      return days;
    } catch (error) {
      return 0;
    }
  }

  calculateHourlyDuration(dateStr, startTime, endTime) {
    try {
      const start = new Date(`${dateStr}T${startTime}:00Z`);
      const end = new Date(`${dateStr}T${endTime}:00Z`);
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return Math.round(diff * 100) / 100;
    } catch (error) {
      return 0;
    }
  }

  async handleDatePickerCallback(query, chatId, telegramId, callbackData) {
    const parts = callbackData.split('|');
    if (parts.length < 3) {
      return;
    }
    const pickerId = parts[1];
    const value = parts[2];
    const conversation = this.conversations.get(chatId);
    console.log('[HR][DatePicker] callback', {
      pickerId,
      value,
      chatId,
      hasConversation: !!conversation,
      step: conversation?.step
    });
    if (!conversation) {
      if (query?.id) {
        await this.bot.answerCallbackQuery(query.id, { text: '⛔️ وضعیت نامعتبر است', show_alert: false }).catch(() => {});
      }
      await this.bot.sendMessage(chatId, '❌ وضعیت نامعتبر است. لطفاً دوباره تلاش کنید.');
      return;
    }

    let ackText = '✅ ثبت شد';
    const answerCallback = async (text) => {
      if (query?.id) {
        try {
          await this.bot.answerCallbackQuery(query.id, { text, show_alert: true });
        } catch (error) {
          console.error('Failed to answer datepicker callback:', error);
        }
      }
    };

    if (value === 'manual') {
      conversation.step = pickerId;
      this.conversations.set(chatId, conversation);
      ackText = '📝 تاریخ را تایپ کنید';
      await answerCallback(ackText);
      await this.bot.sendMessage(chatId, '📝 لطفاً تاریخ را به صورت YYYY-MM-DD یا 1402-12-25 وارد کنید.');
      return;
    }

    const persianLabel = this.formatPersianDate(value);
    ackText = `✅ ${persianLabel}`;
    await answerCallback(ackText);

    await this.applyHrLeaveDateSelectionFromPicker(chatId, conversation, pickerId, value, true);
  }

  async applyHrLeaveDateSelectionFromPicker(chatId, conversation, pickerId, dateValue, fromPicker = false) {
    const pickerTitles = {
      'hr_leave_start_date': '📅 تاریخ شروع مرخصی را انتخاب کنید:',
      'hr_leave_end_date': '📅 تاریخ پایان مرخصی را انتخاب کنید:',
      'hr_leave_hourly_date': '📅 تاریخ مرخصی ساعتی را انتخاب کنید:'
    };
    const parsedDate = this.parseDateInput(dateValue);
    console.log('[HR][DatePicker] parsed date', {
      pickerId,
      dateValue,
      parsedDate,
      step: conversation?.step
    });
    if (!parsedDate) {
      await this.bot.sendMessage(chatId, '❌ تاریخ انتخابی معتبر نیست. لطفاً دوباره تلاش کنید.');
      await this.promptDateSelection(chatId, conversation, {
        pickerId,
        title: pickerTitles[pickerId] || '📅 تاریخ را انتخاب کنید:',
        baseDate: conversation.data?.startDate || null,
        cancelCallback: 'hr_leave_cancel'
      });
      return;
    }

    const data = conversation.data || (conversation.data = {});

    if (pickerId === 'hr_leave_start_date') {
      data.startDate = parsedDate;
      if (fromPicker) {
        await this.bot.sendMessage(chatId, `✅ تاریخ شروع انتخاب شد: ${this.formatPersianDate(parsedDate)}`);
      }
      conversation.step = 'hr_leave_end_date';
      this.conversations.set(chatId, conversation);
      await this.promptDateSelection(chatId, conversation, {
        pickerId: 'hr_leave_end_date',
        title: pickerTitles['hr_leave_end_date'],
        baseDate: parsedDate,
        cancelCallback: 'hr_leave_cancel'
      });
      return;
    }

    if (pickerId === 'hr_leave_end_date') {
      if (!data.startDate) {
        await this.bot.sendMessage(chatId, '❌ ابتدا باید تاریخ شروع را انتخاب کنید.');
        conversation.step = 'hr_leave_start_date';
        this.conversations.set(chatId, conversation);
        await this.promptDateSelection(chatId, conversation, {
          pickerId: 'hr_leave_start_date',
          title: pickerTitles['hr_leave_start_date'],
          cancelCallback: 'hr_leave_cancel'
        });
        return;
      }

      const daysCount = this.calculateDaysCount(data.startDate, parsedDate);
      if (daysCount <= 0) {
        await this.bot.sendMessage(chatId, '❌ تاریخ پایان باید بعد از تاریخ شروع باشد.');
        await this.promptDateSelection(chatId, conversation, {
          pickerId: 'hr_leave_end_date',
          title: pickerTitles['hr_leave_end_date'],
          baseDate: data.startDate,
          cancelCallback: 'hr_leave_cancel'
        });
        return;
      }

      data.endDate = parsedDate;
      data.daysCount = daysCount;
      if (fromPicker) {
        await this.bot.sendMessage(chatId, `✅ تاریخ پایان انتخاب شد: ${this.formatPersianDate(parsedDate)}`);
      }
      conversation.step = 'hr_leave_reason';
      this.conversations.set(chatId, conversation);
      await this.bot.sendMessage(chatId,
        '💬 دلیل مرخصی را وارد کنید (یا "-" برای رد کردن):'
      );
      return;
    }

    if (pickerId === 'hr_leave_hourly_date') {
      data.startDate = parsedDate;
      data.endDate = parsedDate;
      if (fromPicker) {
        await this.bot.sendMessage(chatId, `✅ تاریخ انتخاب شد: ${this.formatPersianDate(parsedDate)}`);
      }
      conversation.step = 'hr_leave_hourly_start_time';
      this.conversations.set(chatId, conversation);
      await this.bot.sendMessage(chatId, '⏰ ساعت شروع را وارد کنید (HH:mm):');
      return;
    }
  }

  async promptDateSelection(chatId, conversation, { pickerId, title, baseDate = null, cancelCallback = 'hr_leave_cancel', days = 14 }) {
    const options = this.buildDatePickerOptions(baseDate, days);
    const rows = [];
    for (let i = 0; i < options.length; i += 2) {
      const row = [];
      row.push({
        text: options[i].label,
        callback_data: `datepick|${pickerId}|${options[i].value}`
      });
      if (options[i + 1]) {
        row.push({
          text: options[i + 1].label,
          callback_data: `datepick|${pickerId}|${options[i + 1].value}`
        });
      }
      rows.push(row);
    }

    rows.push([{ text: '📝 ورود دستی', callback_data: `datepick|${pickerId}|manual` }]);
    rows.push([{ text: '❌ لغو', callback_data: cancelCallback }]);

    await this.bot.sendMessage(chatId,
      `${title}\n\nبا دکمه‌های زیر تاریخ را انتخاب کنید یا "📝 ورود دستی" را بزنید.`,
      {
        reply_markup: {
          inline_keyboard: rows
        },
        parse_mode: 'Markdown'
      }
    );
  }

  buildDatePickerOptions(baseDate = null, days = 14) {
    const options = [];
    let base = baseDate ? new Date(baseDate) : new Date();
    if (Number.isNaN(base.getTime())) {
      base = new Date();
    }

    for (let i = 0; i < days; i++) {
      const date = new Date(base.getTime());
      date.setDate(date.getDate() + i);
      const iso = date.toISOString().slice(0, 10);
      const jalaliDate = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
      const weekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(date);
      const label = `${weekday} ${jalaliDate.jd} ${this.getPersianMonthName(jalaliDate.jm)} ${jalaliDate.jy}`;
      options.push({ label, value: iso });
    }

    return options;
  }

  getPersianMonthName(monthNumber) {
    const months = [
      '',
      'فروردین',
      'اردیبهشت',
      'خرداد',
      'تیر',
      'مرداد',
      'شهریور',
      'مهر',
      'آبان',
      'آذر',
      'دی',
      'بهمن',
      'اسفند'
    ];
    return months[monthNumber] || '';
  }

  // Helper: ask for center note
  async askCenterNote(chatId, conversation) {
    const selectedCenters = conversation.data.selectedCenters || [];
    const currentIndex = conversation.data.currentCenterIndex || 0;
    
    if (currentIndex >= selectedCenters.length) {
      // همه یادداشت‌ها گرفته شد، برو به snapcost
      conversation.step = 'snapcost';
      this.conversations.set(chatId, conversation);
      
      let message = `✅ یادداشت برای همه مراکز ثبت شد\n\n`;
      message += `مرحله 2️⃣: هزینه اسنپ (اختیاری)\n\n`;
      message += `لطفاً هزینه اسنپ را به تومان وارد کنید:\n\n`;
      message += `یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [[
            { text: '⏭️ رد کردن', callback_data: 'skip_snapcost' }
          ]]
        }
      };
      
      await this.bot.sendMessage(chatId, message, keyboard);
      return;
    }
    
    const centerId = selectedCenters[currentIndex];
    const center = Center.getById(centerId);
    const centerName = (center?.name || 'مرکز').replace(/[*_`\[\]()]/g, '');
    
    let message = `✅ ${selectedCenters.length} مرکز انتخاب شد\n\n`;
    message += `مرحله 1️⃣-${currentIndex + 1}: یادداشت برای مرکز "${centerName}" (اختیاری)\n\n`;
    message += `لطفاً یادداشت یا توضیحات این مرکز را وارد کنید:\n\n`;
    message += `یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`;
    
    if (currentIndex < selectedCenters.length - 1) {
      message += `\n\n📋 بعد از این، یادداشت برای ${selectedCenters.length - currentIndex - 1} مرکز دیگر را می‌پرسیم.`;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [[
          { text: '⏭️ رد کردن', callback_data: 'skip_center_note' }
        ]]
      }
    };
    
    await this.bot.sendMessage(chatId, message, keyboard);
  }

  scheduleDailySnapReminder() {
    try {
      if (!this.bot) {
        console.warn('[SnapReminder] Bot not initialized, skipping scheduler setup.');
        return;
      }
      cron.schedule(
        '0 19 * * *',
        () => {
          console.log('[SnapReminder] Running daily snap-cost reminder (Asia/Tehran 19:00)');
          this.sendDailySnapReminders().catch((error) => {
            console.error('[SnapReminder] Reminder job failed:', error);
          });
        },
        { timezone: 'Asia/Tehran' }
      );
      console.log('[SnapReminder] Daily reminder scheduled for 19:00 Asia/Tehran');
    } catch (error) {
      console.error('[SnapReminder] Failed to schedule reminders:', error);
    }
  }

  async sendDailySnapReminders() {
    try {
      const personnelList = await Personnel.getAll();
      if (!personnelList || !personnelList.length) {
        console.log('[SnapReminder] No personnel records found for reminders.');
        return;
      }

      for (const person of personnelList) {
        const telegramIdRaw = person.telegramId ? String(person.telegramId).trim() : '';
        if (!telegramIdRaw || !/^\d+$/.test(telegramIdRaw)) {
          continue;
        }
        const chatId = Number(telegramIdRaw);
        if (!Number.isFinite(chatId)) {
          continue;
        }

        const assignments = await AssignmentModel.getAll({ personnelId: parseInt(person.id) });
        const incompleteSnapCost = assignments.filter((assignment) => {
          if (!assignment) return false;
          const statusMatch = assignment.status === 'approved' || assignment.status === 'completed';
          return statusMatch && this.isSnapCostMissing(assignment.snapCost);
        });

        if (!incompleteSnapCost.length) {
          continue;
        }

        let message = `⏰ یادآوری روزانه ثبت هزینه اسنپ\n\n`;
        message += `کارشناس گرامی ${person.name || ''}\n`;
        message += `ماموریت‌های زیر هنوز هزینه اسنپ ثبت‌شده ندارند:\n\n`;

        incompleteSnapCost.slice(0, 5).forEach((assignment, index) => {
          const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
          message += `${index + 1}. ماموریت #${assignment.id} - ${centerName}\n`;
        });

        if (incompleteSnapCost.length > 5) {
          message += `\nو ${incompleteSnapCost.length - 5} ماموریت دیگر...\n`;
        }

        message += `\nلطفاً از دکمه‌های زیر یا دستور /status_<id> برای تکمیل هزینه استفاده کنید.`;

        const inlineKeyboard = incompleteSnapCost.slice(0, 10).map((assignment) => ([
          { text: `ماموریت #${assignment.id}`, callback_data: `status_${assignment.id}` }
        ]));
        inlineKeyboard.push([{ text: '📋 ماموریت‌های من', callback_data: 'menu_missions' }]);

        await this.bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
      }
    } catch (error) {
      console.error('[SnapReminder] Error while sending reminders:', error);
    }
  }

  isSnapCostMissing(value) {
    if (value === null || value === undefined) {
      return true;
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      return true;
    }
    return num < 0;
  }

  formatCurrency(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('fa-IR');
  }

  filterAssignmentsWithinRange(assignments, startDate, endDate) {
    if (!assignments || assignments.length === 0) {
      return [];
    }
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    return assignments.filter(a => {
      if (!a.createdAt) return false;
      const createdAt = new Date(a.createdAt).getTime();
      return createdAt >= startTime && createdAt <= endTime;
    });
  }
  calculateReportStats(assignments) {
    const stats = {
      total: assignments.length,
      byStatus: {},
      totalSnapCost: 0,
      totalDiscount: 0,
      totalCost: 0,
      totalPersonalPayment: 0
    };

    assignments.forEach(a => {
      const status = a.status || 'نامشخص';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      const snapCostValue = Number(a.snapCost) || 0;
      const discountValue = Number(a.discountAmount) || 0;
      const totalCostValue = Number(a.totalCost) || 0;
      const personalPaymentValue = Number(a.personalPayment) || 0;

      stats.totalSnapCost += snapCostValue;
      stats.totalDiscount += discountValue;
      stats.totalCost += totalCostValue;
      stats.totalPersonalPayment += personalPaymentValue;
    });

    return stats;
  }

  buildAssignmentsList(assignments, limit = 10) {
    if (!assignments.length) {
      return '❌ در این بازه ماموریتی ثبت نشده است.';
    }

    let message = '';
    assignments.slice(0, limit).forEach((assignment, index) => {
      const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const statusLabel = this.getStatusLabel(assignment.status);
      const dateStr = assignment.createdAt ? this.formatPersianDate(assignment.createdAt) : '';
      message += `${index + 1}. ${centerName} - ${statusLabel}${dateStr ? ` (${dateStr})` : ''}\n`;
    });

    if (assignments.length > limit) {
      message += `\n... و ${assignments.length - limit} ماموریت دیگر`;
    }

    return message;
  }

  buildRangeReportMessage({ title, startDate, endDate, assignments, personnelName = null, limit = 10 }) {
    const stats = this.calculateReportStats(assignments);
    const startStr = this.formatPersianDate(startDate.toISOString());
    const endStr = this.formatPersianDate(endDate.toISOString());

    let message = `${title}\n\n`;
    if (personnelName) {
      message += `👤 کارمند: ${personnelName}\n`;
    }
    message += `📅 از ${startStr} تا ${endStr}\n\n`;
    message += `📋 آمار کلی:\n`;
    message += `   • کل ماموریت‌ها: ${stats.total}\n`;

    const statusOrder = ['pending', 'approved', 'in-progress', 'completed', 'rejected', 'cancelled'];
    statusOrder.forEach(status => {
      if (stats.byStatus[status]) {
        message += `   • ${this.getStatusLabel(status)}: ${stats.byStatus[status]}\n`;
      }
    });

    const otherStatuses = Object.keys(stats.byStatus).filter(status => !statusOrder.includes(status));
    otherStatuses.forEach(status => {
      message += `   • ${status}: ${stats.byStatus[status]}\n`;
    });

    message += `\n💰 هزینه‌ها:\n`;
    message += `   • مجموع هزینه اسنپ: ${this.formatCurrency(stats.totalSnapCost)} تومان\n`;
    message += `   • مجموع تخفیف: ${this.formatCurrency(stats.totalDiscount)} تومان\n`;
    message += `   • مجموع هزینه کل: ${this.formatCurrency(stats.totalCost)} تومان\n`;
    message += `   • مجموع پرداخت شخصی: ${this.formatCurrency(stats.totalPersonalPayment)} تومان\n`;

    message += `\n`;
    message += this.buildAssignmentsList(assignments, limit);

    return message;
  }
async showCentersList(chatId, page = 0, searchQuery = '', typeFilter = null, responsibleFilter = null, isManager = false) {
    try {
      const conversation = this.conversations.get(chatId);
      if (!conversation) {
        await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
        return;
      }

      // اگر isManager از conversation قابل تشخیص است، از آن استفاده کنیم
      if (!isManager && conversation.personnelId) {
        const personnel = await Personnel.getById(conversation.personnelId);
        isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
      }

      // فیلتر بر اساس type، search و responsiblePersonnelId
      const filters = {};
      if (typeFilter) {
        filters.type = typeFilter;
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }
      if (responsibleFilter && isManager) {
        filters.responsiblePersonnelId = responsibleFilter;
      }
      
      let centers = await Center.getAll(filters);

      if (centers.length === 0) {
        await this.bot.sendMessage(chatId, '❌ هیچ مرکزی یافت نشد.');
        return;
      }

      const selectedCenters = conversation.data.selectedCenters || [];
      const centersPerPage = 10;
      const totalPages = Math.ceil(centers.length / centersPerPage);
      const centersToShow = centers.slice(page * centersPerPage, (page + 1) * centersPerPage);

      // ایجاد دکمه‌های مراکز با checkbox
      const centerButtons = centersToShow.map(center => {
        const isSelected = selectedCenters.includes(parseInt(center.id));
        // Escape کردن کاراکترهای خاص در نام مرکز برای جلوگیری از خطای parse
        const centerName = (center.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
        return [{
          text: `${isSelected ? '✅ ' : '⬜ '}${centerName}`,
          callback_data: `toggle_center_${center.id}`
        }];
      });

      // دکمه‌های navigation
      const navButtons = [];
      const searchQueryForCallback = searchQuery || '';
      if (page > 0) {
        navButtons.push({ text: '⬅️ قبلی', callback_data: `center_list_page_${page - 1}_${searchQueryForCallback}` });
      }
      if (page < totalPages - 1) {
        navButtons.push({ text: '➡️ بعدی', callback_data: `center_list_page_${page + 1}_${searchQueryForCallback}` });
      }

      // دکمه‌های فیلتر نوع
      const typeButtons = [
        [
          { text: typeFilter === 'lead' ? '✅ سرنخ' : '⚪ سرنخ', callback_data: 'filter_type_lead' },
          { text: typeFilter === 'opportunity' ? '✅ فرصت' : '⚪ فرصت', callback_data: 'filter_type_opportunity' }
        ],
        [
          { text: typeFilter === 'customer' ? '✅ مشتری' : '⚪ مشتری', callback_data: 'filter_type_customer' },
          { text: typeFilter === 'old_customer' ? '✅ مشتری قدیمی' : '⚪ مشتری قدیمی', callback_data: 'filter_type_old_customer' }
        ],
        [
          { text: '🔁 حذف فیلتر', callback_data: 'filter_type_clear' }
        ]
      ];

      // دکمه‌های فیلتر مسئول (فقط برای مدیران)
      const responsibleButtons = [];
      if (isManager) {
        const allPersonnel = await Personnel.getAll();
        const personnelCount = allPersonnel.length;
        if (personnelCount > 0 && personnelCount <= 10) {
          // اگر تعداد پرسنل کم است، همه را نمایش بده
          const responsiblePersonnelButtons = allPersonnel.map(p => [
            { text: responsibleFilter === p.id ? `✅ ${p.name}` : `⚪ ${p.name}`, callback_data: `filter_responsible_${p.id}` }
          ]);
          responsibleButtons.push(...responsiblePersonnelButtons);
        }
        if (responsibleButtons.length > 0 || responsibleFilter) {
          responsibleButtons.push([
            { text: '🔁 حذف فیلتر مسئول', callback_data: 'filter_responsible_clear' }
          ]);
        }
      }

      // دکمه‌های اصلی
      const mainButtons = [
        [{ text: '🔍 جستجو', callback_data: 'search_centers' }],
        [{ text: '📋 لیست کامل مراکز', callback_data: 'show_all_centers' }],
        ...typeButtons
      ];

      if (responsibleButtons.length > 0) {
        mainButtons.push(...responsibleButtons);
      }

      if (selectedCenters.length > 0) {
        mainButtons.push([
          { text: `✅ ادامه با ${selectedCenters.length} مرکز انتخاب شده`, callback_data: 'confirm_centers' },
          { text: '❌ لغو', callback_data: 'cancel_mission' }
        ]);
      } else {
        mainButtons.push([
          { text: '❌ لغو', callback_data: 'cancel_mission' }
        ]);
      }

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            ...centerButtons,
            ...(navButtons.length > 0 ? [navButtons] : []),
            ...mainButtons
          ]
        }
      };

      let message = `➕ ایجاد ماموریت جدید\n\n`;
      message += `مرحله 1️⃣: انتخاب مراکز\n\n`;
      if (searchQuery) {
        message += `🔍 جستجو: "${searchQuery}"\n`;
      }
      if (typeFilter) {
        const typeLabels = {
          'lead': 'سرنخ',
          'opportunity': 'فرصت',
          'customer': 'مشتری',
          'old_customer': 'مشتری قدیمی'
        };
        message += `📌 فیلتر نوع: ${typeLabels[typeFilter] || typeFilter}\n`;
      }
      if (responsibleFilter && isManager) {
        const responsiblePersonnel = await Personnel.getById(responsibleFilter);
        if (responsiblePersonnel) {
          message += `👤 فیلتر مسئول: ${responsiblePersonnel.name}\n`;
        }
      }
      message += `📋 تعداد کل مراکز: ${centers.length}\n`;
      message += `📄 صفحه ${page + 1} از ${totalPages}\n`;
      message += `✅ مراکز انتخاب شده: ${selectedCenters.length}\n\n`;
      message += `لطفاً مراکز مورد نظر را انتخاب کنید:`;

      await this.bot.sendMessage(chatId, message, { ...keyboard });
    } catch (error) {
      console.error('Error in showCentersList:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // Helper: نمایش لیست مراکز استان‌ها (غیرتهرانی)
  async showProvinceCentersList(chatId, page = 0, searchQuery = '') {
    try {
      const conversation = this.conversations.get(chatId);
      if (!conversation || conversation.step !== 'province_center_selection') {
        await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های استان‌ها" شروع کنید.');
        return;
      }

      // فیلتر: فقط مراکز غیرتهرانی
      const filters = {
        isActive: true
      };
      
      let allCenters = await Center.getAll(filters);
      const cityFilter = conversation.data?.cityFilter || null;
      console.log(`[ProvinceCenters] Total centers from getAll: ${allCenters.length}`);
      
      // فیلتر کردن مراکز غیرتهرانی
      allCenters = allCenters.filter(c => {
        if (!c.city) return false;
        const cityLower = c.city.toLowerCase();
        return cityLower !== 'تهران' && cityLower !== 'tehran' && !cityLower.includes('تهران');
      });
      
      // اعمال فیلتر استان (در صورت وجود)
      if (cityFilter) {
        allCenters = allCenters.filter(c => c.city && c.city === cityFilter);
      }
      
      // اگر searchQuery وجود دارد، جستجو در نام مرکز، شهر (استان) و نام مسئول
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase().trim();
        allCenters = allCenters.filter(c => {
          const nameMatch = c.name && c.name.toLowerCase().includes(queryLower);
          const cityMatch = c.city && c.city.toLowerCase().includes(queryLower);
          const responsibleMatch = c.responsiblePersonnelName && c.responsiblePersonnelName.toLowerCase().includes(queryLower);
          return nameMatch || cityMatch || responsibleMatch;
        });
      }
      
      console.log(`[ProvinceCenters] Non-Tehrans after filter: ${allCenters.length}`);

      if (allCenters.length === 0) {
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 جستجو', callback_data: 'province_search_centers' }],
              [{ text: '🏠 بازگشت به منو', callback_data: 'menu_back_to_main' }]
            ]
          }
        };
        await this.bot.sendMessage(chatId, '❌ هیچ مرکز استان‌ای یافت نشد.\n\n💡 می‌توانید از جستجو استفاده کنید یا مراکز جدید اضافه کنید.', keyboard);
        return;
      }

      const centersPerPage = 10;
      const totalPages = Math.ceil(allCenters.length / centersPerPage);
      const centersToShow = allCenters.slice(page * centersPerPage, (page + 1) * centersPerPage);

      // Helper: گرفتن emoji برای نوع مرکز
      const getTypeEmoji = (type) => {
        const emojis = {
          'lead': '🔵',
          'opportunity': '🟢',
          'customer': '🟡',
          'old_customer': '🟠'
        };
        return emojis[type] || '⚪';
      };

      let message = `📞 *تماس‌های استان‌ها*\n\n`;
      message += `📊 تعداد کل: ${allCenters.length} مرکز\n`;
      if (searchQuery) {
        message += `🔍 جستجو: ${searchQuery}\n`;
      }
      if (cityFilter) {
        message += `📍 فیلتر استان: ${cityFilter}\n`;
      }
      message += `\n📋 *مراکز (صفحه ${page + 1} از ${totalPages}):*\n\n`;

      const keyboardButtons = [];
      centersToShow.forEach((center) => {
        const centerName = (center.name || 'مرکز').replace(/[*_`\[\]()]/g, '');
        const city = (center.city || '').replace(/[*_`\[\]()]/g, '');
        const responsibleName = (center.responsiblePersonnelName || '').replace(/[*_`\[\]()]/g, '');
        
        // خواندن برچسب‌ها از مرکز
        let centerTags = [];
        if (center.tags) {
          if (Array.isArray(center.tags)) {
            centerTags = center.tags;
          } else if (typeof center.tags === 'string') {
            try {
              centerTags = JSON.parse(center.tags);
              if (!Array.isArray(centerTags)) {
                centerTags = [];
              }
            } catch (e) {
              centerTags = [];
            }
          }
        }
        
        // اگر برچسبی نداشت، از type استفاده کن
        const centerType = centerTags.length > 0 ? centerTags[0] : (center.type || 'lead');
        const typeEmoji = getTypeEmoji(centerType);
        
        // ساخت label برای دکمه
        let buttonText = `📞 ${centerName}`;
        
        // اضافه کردن emoji نوع مرکز
        if (centerType) {
          buttonText += ` ${typeEmoji}`;
        }
        
        // اضافه کردن شهر (اگر وجود دارد)
        if (city) {
          const cityLabel = city.length > 8 ? city.substring(0, 8) + '...' : city;
          buttonText += `\n  📍 ${cityLabel}`;
        }
        
        // اضافه کردن مسئول (اگر وجود دارد)
        if (responsibleName) {
          const responsibleLabel = responsibleName.length > 10 
            ? responsibleName.substring(0, 10) + '...' 
            : responsibleName;
          buttonText += ` 👤 ${responsibleLabel}`;
        }
        
        keyboardButtons.push([{ 
          text: buttonText, 
          callback_data: `province_select_center_${center.id}` 
        }]);
      });

      // دکمه‌های navigation
      const navButtons = [];
      if (page > 0) {
        navButtons.push({ text: '◀️ قبلی', callback_data: `province_centers_page_${page - 1}` });
      }
      if (page < totalPages - 1) {
        navButtons.push({ text: '▶️ بعدی', callback_data: `province_centers_page_${page + 1}` });
      }
      if (navButtons.length > 0) {
        keyboardButtons.push(navButtons);
      }

      // دکمه‌های فیلتر و جستجو
      const filterButtons = [];
      
      if (cityFilter) {
        filterButtons.push({ text: `📍 فیلتر: ${cityFilter}`, callback_data: 'province_filter_city_menu' });
        filterButtons.push({ text: '🔁 حذف فیلتر', callback_data: 'province_filter_city_clear' });
      } else {
        filterButtons.push({ text: '📍 فیلتر استان', callback_data: 'province_filter_city_menu' });
      }
      
      keyboardButtons.push([
        { text: '🔍 جستجو', callback_data: 'province_search_centers' },
        ...filterButtons
      ]);
      
      keyboardButtons.push([
        { text: '🏠 بازگشت به منو', callback_data: 'menu_back_to_main' }
      ]);

      const keyboard = {
        reply_markup: {
          inline_keyboard: keyboardButtons
        }
      };

      message += `\n💡 *راهنمایی:*\n`;
      message += `   • برای ثبت تماس روی مرکز کلیک کنید\n`;
      message += `   • 🔵 سرنخ | 🟢 فرصت | 🟡 مشتری | 🟠 قدیمی\n`;

      await this.bot.sendMessage(chatId, message, { 
        ...keyboard,
        parse_mode: 'Markdown'
      });

      // ذخیره صفحه فعلی
      conversation.data.currentProvincePage = page;
      this.conversations.set(chatId, conversation);
    } catch (error) {
      console.error('Error in showProvinceCentersList:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // Helper: نمایش لیست مراکز تهران
  async showTehranCentersList(chatId, page = 0, searchQuery = '') {
    try {
      const conversation = this.conversations.get(chatId);
      if (!conversation || conversation.step !== 'province_center_selection') {
        await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های تهران" شروع کنید.');
        return;
      }

      // مثل بخش ماموریت: نمایش همه مراکز فعال
      // بدون فیلتر خاص تهران - کاربر خودش جستجو می‌کند
      const filters = {
        isActive: true
      };
      
      if (searchQuery) {
        filters.search = searchQuery;
      }
      
      // نمایش همه مراکز فعال (مثل بخش ماموریت)
      // کاربر می‌تواند با جستجو یا فیلتر کارشناس مراکز را محدود کند
      let allCenters = await Center.getAll(filters);
      const expertFilter = conversation.data?.tehranExpertFilter || null;
      console.log(`[TehranCenters] Total centers (all active): ${allCenters.length}`);
      
      
      // اعمال فیلتر کارشناس (در صورت وجود)
      if (expertFilter) {
        if (expertFilter.id === 'none') {
          allCenters = allCenters.filter(c => !c.responsiblePersonnelId);
        } else {
          allCenters = allCenters.filter(c => c.responsiblePersonnelId && c.responsiblePersonnelId.toString() === expertFilter.id);
        }
      }
      
      // اگر searchQuery وجود دارد، جستجو در نام مرکز و نام مسئول
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase().trim();
        allCenters = allCenters.filter(c => {
          const nameMatch = c.name && c.name.toLowerCase().includes(queryLower);
          const responsibleMatch = c.responsiblePersonnelName && c.responsiblePersonnelName.toLowerCase().includes(queryLower);
          return nameMatch || responsibleMatch;
        });
        console.log(`[TehranCenters] Tehran centers after search filter: ${allCenters.length}`);
      }

      if (allCenters.length === 0) {
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 جستجو', callback_data: 'province_search_centers' }],
              [{ text: '🏠 بازگشت به منو', callback_data: 'menu_back_to_main' }]
            ]
          }
        };
        await this.bot.sendMessage(chatId, '❌ هیچ مرکز تهرانی یافت نشد.\n\n💡 می‌توانید از جستجو استفاده کنید یا مراکز جدید اضافه کنید.', keyboard);
        return;
      }

      const centersPerPage = 10;
      const totalPages = Math.ceil(allCenters.length / centersPerPage);
      const centersToShow = allCenters.slice(page * centersPerPage, (page + 1) * centersPerPage);

      // Helper: گرفتن emoji برای نوع مرکز
      const getTypeEmoji = (type) => {
        const emojis = {
          'lead': '🔵',
          'opportunity': '🟢',
          'customer': '🟡',
          'old_customer': '🟠'
        };
        return emojis[type] || '⚪';
      };

      let message = `📞 *تماس‌های تهران*\n\n`;
      message += `📊 تعداد کل: ${allCenters.length} مرکز\n`;
      if (searchQuery) {
        message += `🔍 جستجو: ${searchQuery}\n`;
      }
      if (expertFilter) {
        const expertName = (expertFilter.name || 'بدون مسئول').replace(/[*_`\[\]()]/g, '');
        message += `👤 فیلتر کارشناس: ${expertName}\n`;
      }
      message += `\n📋 *مراکز (صفحه ${page + 1} از ${totalPages}):*\n\n`;
      const keyboardButtons = [];
      centersToShow.forEach((center) => {
        const centerName = (center.name || 'مرکز').replace(/[*_`\[\]()]/g, '');
        const responsibleName = (center.responsiblePersonnelName || '').replace(/[*_`\[\]()]/g, '');
        
        // خواندن برچسب‌ها از مرکز
        let centerTags = [];
        if (center.tags) {
          if (Array.isArray(center.tags)) {
            centerTags = center.tags;
          } else if (typeof center.tags === 'string') {
            try {
              centerTags = JSON.parse(center.tags);
              if (!Array.isArray(centerTags)) {
                centerTags = [];
              }
            } catch (e) {
              centerTags = [];
            }
          }
        }
        
        // اگر برچسبی نداشت، از type استفاده کن
        const centerType = centerTags.length > 0 ? centerTags[0] : (center.type || 'lead');
        const typeEmoji = getTypeEmoji(centerType);
        
        // ساخت label برای دکمه
        let buttonText = `📞 ${centerName}`;
        
        // اضافه کردن emoji نوع مرکز
        if (centerType) {
          buttonText += ` ${typeEmoji}`;
        }
        
        // اضافه کردن مسئول (اگر وجود دارد)
        if (responsibleName) {
          const responsibleLabel = responsibleName.length > 10 
            ? responsibleName.substring(0, 10) + '...' 
            : responsibleName;
          buttonText += ` 👤 ${responsibleLabel}`;
        }
        
        keyboardButtons.push([{ 
          text: buttonText, 
          callback_data: `province_select_center_${center.id}` 
        }]);
      });

      // دکمه‌های pagination و navigation
      const navButtons = [];
      if (page > 0) {
        navButtons.push({ text: '◀️ قبلی', callback_data: `province_centers_page_${page - 1}` });
      }
      if (page < totalPages - 1) {
        navButtons.push({ text: '▶️ بعدی', callback_data: `province_centers_page_${page + 1}` });
      }
      console.log(`[TehranCenters] Navigation buttons: page=${page}, totalPages=${totalPages}, navButtons.length=${navButtons.length}`);
      if (navButtons.length > 0) {
        keyboardButtons.push(navButtons);
        console.log(`[TehranCenters] Added navigation buttons to keyboard`);
      } else {
        console.log(`[TehranCenters] No navigation buttons to add (page=${page}, totalPages=${totalPages})`);
      }

      const filterButtonLabel = expertFilter
        ? `👤 کارشناس: ${(expertFilter.name || 'بدون مسئول').length > 18 ? (expertFilter.name || 'بدون مسئول').slice(0, 18) + '…' : (expertFilter.name || 'بدون مسئول')}`
        : '👤 فیلتر کارشناس';
      keyboardButtons.push([
        { text: filterButtonLabel, callback_data: 'tehran_filter_expert_menu' }
      ]);
      if (expertFilter) {
        keyboardButtons.push([
          { text: '❌ حذف فیلتر کارشناس', callback_data: 'tehran_filter_expert_clear' }
        ]);
      }

      keyboardButtons.push([
        { text: '🔍 جستجو', callback_data: 'province_search_centers' }
      ]);
      keyboardButtons.push([
        { text: '🏠 بازگشت به منو', callback_data: 'menu_back_to_main' }
      ]);

      const keyboard = {
        reply_markup: {
          inline_keyboard: keyboardButtons
        }
      };

      await this.bot.sendMessage(chatId, message, { 
        ...keyboard,
        parse_mode: 'Markdown'
      });

      // ذخیره صفحه فعلی در conversation
      conversation.data.currentProvincePage = page;
      this.conversations.set(chatId, conversation);
    } catch (error) {
      console.error('Error in showTehranCentersList:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  async showTehranExpertFilterMenu(chatId, page = 0) {
    try {
      const conversation = this.conversations.get(chatId);
      if (!conversation || conversation.data?.contactType !== 'tehran') {
        await this.bot.sendMessage(chatId, '❌ لطفاً از منوی "تماس‌های تهران" شروع کنید.');
        return;
      }

      const filters = { isActive: true };
      const tehranCenters = Center.getAll(filters).filter(c => {
        if (!c.city) return false;
        const cityLower = c.city.toLowerCase();
        return cityLower === 'تهران' || cityLower === 'tehran' || cityLower.includes('تهران');
      });

      if (tehranCenters.length === 0) {
        await this.bot.sendMessage(chatId, '❌ هیچ مرکز تهرانی برای فیلتر کارشناس وجود ندارد.');
        return;
      }

      const expertCounts = {};
      const expertInfoMap = new Map();
      let hasUnassigned = false;

      tehranCenters.forEach(center => {
        const key = center.responsiblePersonnelId ? center.responsiblePersonnelId.toString() : 'none';
        expertCounts[key] = (expertCounts[key] || 0) + 1;
        if (key === 'none') {
          hasUnassigned = true;
        } else if (!expertInfoMap.has(key)) {
          const name = center.responsiblePersonnelName || `کارشناس ${key}`;
          expertInfoMap.set(key, { id: key, name });
        }
      });

      const experts = Array.from(expertInfoMap.values()).sort((a, b) => {
        const nameA = (a.name || '').toString();
        const nameB = (b.name || '').toString();
        return nameA.localeCompare(nameB, 'fa');
      });

      if (hasUnassigned) {
        experts.unshift({ id: 'none', name: 'بدون مسئول' });
      }

      if (experts.length === 0) {
        await this.bot.sendMessage(chatId, '❌ هیچ کارشناس مسئولی برای مراکز تهران ثبت نشده است.');
        return;
      }

      const expertsPerPage = 10;
      const totalPages = Math.max(1, Math.ceil(experts.length / expertsPerPage));
      const safePage = Math.min(Math.max(page, 0), totalPages - 1);
      const expertsToShow = experts.slice(safePage * expertsPerPage, (safePage + 1) * expertsPerPage);

      let message = `👤 *فیلتر کارشناس - مراکز تهران*

`;
      message += `📊 تعداد کارشناسان: ${experts.length}
`;
      if (conversation.data?.tehranExpertFilter) {
        const currentName = (conversation.data.tehranExpertFilter.name || 'بدون مسئول').replace(/[*_`\[\]()]/g, '');
        message += `🔎 فیلتر فعال: ${currentName}
`;
      }
      message += `
📋 *لیست کارشناسان (صفحه ${safePage + 1} از ${totalPages}):*

`;

      const keyboardButtons = [];
      const expertMap = {};

      expertsToShow.forEach((expert, idx) => {
        const globalIndex = safePage * expertsPerPage + idx;
        const countKey = expert.id || 'none';
        const count = expertCounts[countKey] || 0;
        const displayName = (expert.name || 'بدون نام').replace(/[*_`\[\]()]/g, '');
        message += `${globalIndex + 1}. ${displayName} (${count} مرکز)
`;

        expertMap[globalIndex] = {
          id: expert.id,
          name: expert.name || 'بدون نام'
        };

        const shortName = displayName.length > 18 ? displayName.slice(0, 18) + '…' : displayName;
        keyboardButtons.push([
          { text: `${shortName} (${count})`, callback_data: `tehran_filter_expert_idx_${globalIndex}` }
        ]);
      });

      const navButtons = [];
      if (safePage > 0) {
        navButtons.push({ text: '◀️ قبلی', callback_data: `tehran_filter_expert_page_${safePage - 1}` });
      }
      if (safePage < totalPages - 1) {
        navButtons.push({ text: '▶️ بعدی', callback_data: `tehran_filter_expert_page_${safePage + 1}` });
      }
      if (navButtons.length > 0) {
        keyboardButtons.push(navButtons);
      }

      if (conversation.data?.tehranExpertFilter) {
        keyboardButtons.push([
          { text: '❌ حذف فیلتر', callback_data: 'tehran_filter_expert_clear' }
        ]);
      }

      keyboardButtons.push([
        { text: '🔙 بازگشت', callback_data: 'province_back_to_list' }
      ]);

      conversation.data.tehranExpertMap = expertMap;
      this.conversations.set(chatId, conversation);

      const keyboard = {
        reply_markup: {
          inline_keyboard: keyboardButtons
        }
      };

      await this.bot.sendMessage(chatId, message, {
        ...keyboard,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Error in showTehranExpertFilterMenu:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }
async handleConversationMessage(msg, conversation) {
    const chatId = msg.chat.id;
    const text = msg.text;

    try {
      // Handle medical search
      if (conversation.step === 'medical_search') {
        await this.handleMedicalSearchMessage(msg, conversation);
        return;
      }

      // Handle file uploads for medical upload (must be checked first)
      if (conversation.step && (conversation.step.startsWith('medical_upload_') || conversation.step === 'medical_center_search')) {
        // Check if message contains a file (document or photo) or text
        if (msg.document || msg.photo || text) {
          await this.handleMedicalUploadConversationMessage(msg, conversation);
          return;
        }
      }

      if (conversation.step && conversation.step.startsWith('hr_leave_')) {
        await this.handleHrLeaveConversationMessage(msg, conversation);
        return;
      }

      // ========== Handle add center conversation ==========
      if (conversation.step === 'add_center_name') {
        conversation.data.name = text;
        conversation.step = 'add_center_type';
        this.conversations.set(chatId, conversation);
        
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⚪ سرنخ', callback_data: 'add_center_type_lead' },
                { text: '⚪ فرصت', callback_data: 'add_center_type_opportunity' }
              ],
              [
                { text: '⚪ مشتری', callback_data: 'add_center_type_customer' },
                { text: '⚪ مشتری قدیمی', callback_data: 'add_center_type_old_customer' }
              ]
            ]
          }
        };

        await this.bot.sendMessage(chatId,
          `✅ نام مرکز ثبت شد: "${text}"\n\n` +
          `مرحله 2️⃣: نوع مرکز\n\n` +
          `لطفاً نوع مرکز را انتخاب کنید:`,
          keyboard
        );
        return;
      }

      if (conversation.step === 'add_center_address') {
        conversation.data.address = text;
        conversation.step = 'add_center_city';
        this.conversations.set(chatId, conversation);
        
        await this.bot.sendMessage(chatId,
          `✅ آدرس ثبت شد\n\n` +
          `مرحله 4️⃣: شهر\n\n` +
          `لطفاً نام شهر را وارد کنید:`
        );
        return;
      }

      if (conversation.step === 'add_center_city') {
        conversation.data.city = text;
        conversation.step = 'add_center_district';
        this.conversations.set(chatId, conversation);
        
        await this.bot.sendMessage(chatId,
          `✅ شهر ثبت شد: "${text}"\n\n` +
          `مرحله 5️⃣: منطقه (اختیاری)\n\n` +
          `لطفاً نام منطقه را وارد کنید یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '⏭️ رد کردن', callback_data: 'add_center_skip_district' }
              ]]
            }
          }
        );
        return;
      }

      if (conversation.step === 'add_center_district') {
        conversation.data.district = text;
        conversation.step = 'add_center_responsible';
        this.conversations.set(chatId, conversation);
        
        // نمایش لیست پرسنل برای انتخاب مسئول
        const allPersonnel = await Personnel.getAll();
        const personnelButtons = allPersonnel.slice(0, 10).map(p => [
          { text: p.name, callback_data: `add_center_responsible_${p.id}` }
        ]);
        personnelButtons.push([
          { text: '⏭️ بدون مسئول', callback_data: 'add_center_skip_responsible' }
        ]);

        await this.bot.sendMessage(chatId,
          `✅ منطقه ثبت شد: "${text}"\n\n` +
          `مرحله 6️⃣: مسئول مرکز (اختیاری)\n\n` +
          `لطفاً مسئول مرکز را انتخاب کنید:`,
          {
            reply_markup: {
              inline_keyboard: personnelButtons
            }
          }
        );
        return;
      }

      // ========== Handle center search ==========
      if (conversation.step === 'center_search') {
        conversation.step = 'center_selection';
        this.conversations.set(chatId, conversation);
        let isManager = false;
        if (conversation.personnelId) {
          const personnel = await Personnel.getById(conversation.personnelId);
          isManager = personnel && (personnel.role === 'admin' || personnel.role === 'manager');
        }
        const typeFilter = conversation.data?.typeFilter || null;
        const responsibleFilter = conversation.data?.responsibleFilter || null;
        await this.showCentersList(chatId, 0, text, typeFilter, responsibleFilter, isManager);
        return;
      }

      // ========== Handle manage centers search ==========
      if (conversation.step === 'manage_centers_search') {
        conversation.step = 'manage_centers';
        conversation.data = conversation.data || {};
        conversation.data.searchQuery = text.trim();
        this.conversations.set(chatId, conversation);
        const typeFilter = conversation.data?.typeFilter || null;
        const responsibleFilter = conversation.data?.responsibleFilter || null;
        const searchQuery = conversation.data.searchQuery;
        await this.showManageCentersMenu(chatId, 0, typeFilter, responsibleFilter, searchQuery);
        return;
      }

      // ========== Handle weekly report personnel name ==========
      if (conversation.step === 'weekly_report_personnel_name') {
        const personnelName = text.trim();
        if (!personnelName) {
          await this.bot.sendMessage(chatId, '❌ لطفاً نام کارمند را وارد کنید.');
          return;
        }

        try {
          const axios = (await import('axios')).default;
          const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
          const response = await axios.get(`${baseUrl}/api/reports/weekly`, {
            params: {
              personnelName: personnelName
            }
          });

          const { weekInfo, assignments, stats } = response.data;

          let message = `📅 گزارش هفتگی کارمند\n\n`;
          message += `👤 کارمند: ${personnelName}\n\n`;
          message += `📆 هفته ${weekInfo.weekNumber} سال ${weekInfo.year}\n`;
          message += `📅 از ${weekInfo.startDatePersianFormatted || weekInfo.startDatePersian} تا ${weekInfo.endDatePersianFormatted || weekInfo.endDatePersian}\n\n`;
          message += `📊 آمار کلی:\n`;
          message += `   • کل ماموریت‌ها: ${stats.total}\n`;
          
          if (stats.byStatus.pending) message += `   • در انتظار: ${stats.byStatus.pending}\n`;
          if (stats.byStatus.approved) message += `   • تایید شده: ${stats.byStatus.approved}\n`;
          if (stats.byStatus.completed) message += `   • تکمیل شده: ${stats.byStatus.completed}\n`;
          
          message += `\n💰 هزینه‌ها:\n`;
          message += `   • مجموع هزینه اسنپ: ${(stats.totalSnapCost || 0).toLocaleString('fa-IR')} تومان\n`;
          message += `   • مجموع تخفیف: ${(stats.totalDiscount || 0).toLocaleString('fa-IR')} تومان\n`;
          message += `   • مجموع هزینه کل: ${(stats.totalCost || 0).toLocaleString('fa-IR')} تومان\n`;
          message += `   • مجموع پرداخت شخصی: ${(stats.totalPersonalPayment || 0).toLocaleString('fa-IR')} تومان\n`;

          if (assignments.length > 0) {
            message += `\n📋 ماموریت‌ها:\n`;
            assignments.slice(0, 15).forEach((assignment, index) => {
              const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
              const statusLabel = this.getStatusLabel(assignment.status);
              const dateStr = assignment.createdAtPersianFormatted || assignment.createdAtPersian || '';
              message += `${index + 1}. ${centerName} - ${statusLabel}${dateStr ? ` (${dateStr})` : ''}\n`;
            });
            if (assignments.length > 15) {
              message += `\n... و ${assignments.length - 15} ماموریت دیگر`;
            }
          } else {
            message += `\n❌ ماموریتی یافت نشد.`;
          }

          this.conversations.delete(chatId);
          await this.bot.sendMessage(chatId, message);
        } catch (error) {
          console.error('❌ Error in weekly personnel report:', error);
          await this.bot.sendMessage(chatId, `❌ خطا در دریافت گزارش: ${error.message}`);
          this.conversations.delete(chatId);
        }
        return;
      }

      // ========== Handle monthly report personnel name ==========
      if (conversation.step === 'monthly_report_personnel_name') {
        const personnelName = text.trim();
        if (!personnelName) {
          await this.bot.sendMessage(chatId, '❌ لطفاً نام کارمند را وارد کنید.');
          return;
        }

        try {
          const axios = (await import('axios')).default;
          const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
          const response = await axios.get(`${baseUrl}/api/reports/monthly`, {
            params: {
              personnelName: personnelName
            }
          });

          const { monthInfo, assignments, stats } = response.data;

          let message = `📆 گزارش ماهانه کارمند\n\n`;
          message += `👤 کارمند: ${personnelName}\n\n`;
          message += `📅 ${monthInfo.monthNamePersian} ${monthInfo.year}\n`;
          message += `📅 از ${monthInfo.startDatePersianFormatted || monthInfo.startDatePersian} تا ${monthInfo.endDatePersianFormatted || monthInfo.endDatePersian}\n\n`;
          message += `📊 آمار کلی:\n`;
          message += `   • کل ماموریت‌ها: ${stats.total}\n`;
          
          if (stats.byStatus.pending) message += `   • در انتظار: ${stats.byStatus.pending}\n`;
          if (stats.byStatus.approved) message += `   • تایید شده: ${stats.byStatus.approved}\n`;
          if (stats.byStatus.completed) message += `   • تکمیل شده: ${stats.byStatus.completed}\n`;
          
          message += `\n💰 هزینه‌ها:\n`;
          message += `   • مجموع هزینه اسنپ: ${(stats.totalSnapCost || 0).toLocaleString('fa-IR')} تومان\n`;
          message += `   • مجموع تخفیف: ${(stats.totalDiscount || 0).toLocaleString('fa-IR')} تومان\n`;
          message += `   • مجموع هزینه کل: ${(stats.totalCost || 0).toLocaleString('fa-IR')} تومان\n`;
          message += `   • مجموع پرداخت شخصی: ${(stats.totalPersonalPayment || 0).toLocaleString('fa-IR')} تومان\n`;

          if (assignments.length > 0) {
            message += `\n📋 ماموریت‌ها:\n`;
            assignments.slice(0, 15).forEach((assignment, index) => {
              const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
              const statusLabel = this.getStatusLabel(assignment.status);
              const dateStr = assignment.createdAtPersianFormatted || assignment.createdAtPersian || '';
              message += `${index + 1}. ${centerName} - ${statusLabel}${dateStr ? ` (${dateStr})` : ''}\n`;
            });
            if (assignments.length > 15) {
              message += `\n... و ${assignments.length - 15} ماموریت دیگر`;
            }
          } else {
            message += `\n❌ ماموریتی یافت نشد.`;
          }

          this.conversations.delete(chatId);
          await this.bot.sendMessage(chatId, message);
        } catch (error) {
          console.error('❌ Error in monthly personnel report:', error);
          await this.bot.sendMessage(chatId, `❌ خطا در دریافت گزارش: ${error.message}`);
          this.conversations.delete(chatId);
        }
        return;
      }

      // ========== Handle edit notes ==========
      if (conversation.step === 'edit_notes') {
        const notes = text.trim();
        const assignment = AssignmentModel.getById(conversation.assignmentId);
        if (!assignment) {
          await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
          this.conversations.delete(chatId);
          return;
        }

        AssignmentModel.update(conversation.assignmentId, { notes: notes || null });
        this.conversations.delete(chatId);
        
        await this.bot.sendMessage(chatId, 
          `✅ یادداشت به‌روزرسانی شد!\n\n` +
          `📝 یادداشت: ${notes || '(خالی)'}`
        );
        
        // نمایش مجدد جزئیات
        await this.handleStatusCommand(chatId, conversation.assignmentId, msg.from.id.toString());
        return;
      }

      // ========== Handle edit snapcost ==========
      if (conversation.step === 'edit_snapcost') {
        const textTrimmed = text.trim();
        const snapCost = parseFloat(textTrimmed);
        
        if (isNaN(snapCost) || snapCost < 0 || !textTrimmed.match(/^\d+(\.\d+)?$/)) {
          await this.bot.sendMessage(chatId, '❌ لطفاً یک عدد معتبر وارد کنید (مثال: 50000 یا 50000.5)');
          return;
        }

        const assignment = AssignmentModel.getById(conversation.assignmentId);
        if (!assignment) {
          await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
          this.conversations.delete(chatId);
          return;
        }

        // به‌روزرسانی هزینه اسنپ و محاسبه مجدد
        // snapCost = کل هزینه اسنپ (بدون تخفیف)
        // discountAmount = مبلغ کد تخفیف
        // personalPayment = باقی‌مانده بعد از تخفیف (اگر snapCost < discountAmount باشد، صفر است)
        // totalCost = هزینه کل که باید پرداخت شود = personalPayment
        
        const discountCode = assignment.discountCode;
        const discountCodeId = assignment.discountCodeId;
        let finalDiscountCodeId = discountCodeId;
        let discountDetails = null;

        if (discountCode) {
          const discount = await DiscountCode.getByCode(discountCode);
          if (discount && discount.isActive) {
            finalDiscountCodeId = discount.id;
            discountDetails = discount;
          }
        } else if (discountCodeId) {
          // اگر فقط discountCodeId وجود دارد
          const discount = await DiscountCode.getById(discountCodeId);
          if (discount && discount.isActive) {
            discountDetails = discount;
          } else {
            finalDiscountCodeId = null;
          }
        }

        const { companyShare, personalPayment } = AssignmentModel.calculateCostBreakdown(snapCost, discountDetails);

        await AssignmentModel.update(conversation.assignmentId, { 
          snapCost, 
          discountCodeId: finalDiscountCodeId
        });
        this.conversations.delete(chatId);
        
        await this.bot.sendMessage(chatId, 
          `✅ هزینه اسنپ به‌روزرسانی شد!\n\n` +
          `💰 هزینه اسنپ: ${snapCost.toLocaleString('fa-IR')} تومان\n` +
          `🏢 سهم شرکت: ${companyShare.toLocaleString('fa-IR')} تومان\n` +
          `👤 سهم کارشناس: ${personalPayment.toLocaleString('fa-IR')} تومان`
        );
        
        // نمایش مجدد جزئیات
        await this.handleStatusCommand(chatId, conversation.assignmentId, msg.from.id.toString());
        return;
      }

      // ========== Handle edit payment ==========
      if (conversation.step === 'edit_payment') {
        const textTrimmed = text.trim();
        const personalPayment = parseFloat(textTrimmed);
        
        if (isNaN(personalPayment) || personalPayment < 0 || !textTrimmed.match(/^\d+(\.\d+)?$/)) {
          await this.bot.sendMessage(chatId, '❌ لطفاً یک عدد معتبر وارد کنید (مثال: 50000 یا 50000.5)');
          return;
        }

        const assignment = AssignmentModel.getById(conversation.assignmentId);
        if (!assignment) {
          await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
          this.conversations.delete(chatId);
          return;
        }

        AssignmentModel.update(conversation.assignmentId, { personalPayment });
        this.conversations.delete(chatId);
        
        await this.bot.sendMessage(chatId, 
          `✅ پرداخت شخصی به‌روزرسانی شد!\n\n` +
          `💳 پرداخت شخصی: ${personalPayment.toLocaleString('fa-IR')} تومان`
        );
        
        // نمایش مجدد جزئیات
        await this.handleStatusCommand(chatId, conversation.assignmentId, msg.from.id.toString());
        return;
      }

      // ========== Handle add snap cost ==========
      if (conversation.step === 'add_snapcost') {
        // بررسی اینکه آیا متن وارد شده یک عدد است
        const textTrimmed = text.trim();
        const snapCost = parseFloat(textTrimmed);
        
        // بررسی اینکه آیا عدد معتبر است
        if (isNaN(snapCost) || snapCost < 0 || !textTrimmed.match(/^\d+(\.\d+)?$/)) {
          await this.bot.sendMessage(chatId, '❌ لطفاً یک عدد معتبر وارد کنید (مثال: 50000 یا 50000.5)');
          return;
        }

        const assignment = await AssignmentModel.getById(conversation.assignmentId);
        if (!assignment) {
          await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
          this.conversations.delete(chatId);
          return;
        }

        // به‌روزرسانی هزینه اسنپ
        // snapCost = کل هزینه اسنپ (بدون تخفیف)
        // discountAmount = مبلغ کد تخفیف
        // personalPayment = باقی‌مانده بعد از تخفیف (اگر snapCost < discountAmount باشد، صفر است)
        // totalCost = هزینه کل که باید پرداخت شود = personalPayment
        
        const discountCode = assignment.discountCode;
        const discountCodeId = assignment.discountCodeId;
        let finalDiscountCodeId = discountCodeId;
        let discountDetails = null;

        if (discountCode) {
          const discount = await DiscountCode.getByCode(discountCode);
          if (discount && discount.isActive) {
            finalDiscountCodeId = discount.id;
            discountDetails = discount;
          }
        } else if (discountCodeId) {
          // اگر فقط discountCodeId وجود دارد
          const discount = await DiscountCode.getById(discountCodeId);
          if (discount && discount.isActive) {
            discountDetails = discount;
          } else {
            finalDiscountCodeId = null;
          }
        }

        const { companyShare, personalPayment } = AssignmentModel.calculateCostBreakdown(snapCost, discountDetails);

        await AssignmentModel.update(conversation.assignmentId, {
          snapCost,
          discountCodeId: finalDiscountCodeId
        });

        this.conversations.delete(chatId);

        const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
        let message = `✅ هزینه اسنپ ثبت شد!\n\n` +
          `📋 ماموریت #${assignment.id}\n` +
          `🏢 مرکز: ${centerName}\n` +
          `💰 هزینه اسنپ: ${snapCost.toLocaleString('fa-IR')} تومان\n` +
          `🏢 سهم شرکت: ${companyShare.toLocaleString('fa-IR')} تومان\n` +
          `👤 سهم کارشناس: ${personalPayment.toLocaleString('fa-IR')} تومان`;

        // بررسی اینکه آیا هزینه‌های ثبت نشده دیگری وجود دارد
        const personnel = await Personnel.getById(assignment.personnelId);
        if (personnel) {
          const allAssignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
          const remainingIncomplete = allAssignments.filter(a => {
            const snapCostValue = a.snapCost;
            // تبدیل به number برای مقایسه
            const snapCostNum = snapCostValue === null || snapCostValue === undefined ? 0 : Number(snapCostValue);
            const hasNoSnapCost = isNaN(snapCostNum) || snapCostNum <= 0;
            return a.id !== assignment.id &&
              (a.status === 'approved' || a.status === 'completed') && 
              hasNoSnapCost;
          });

          if (remainingIncomplete.length > 0) {
            message += `\n\n⚠️ هنوز ${remainingIncomplete.length} ماموریت دیگر بدون هزینه اسنپ وجود دارد.`;
            message += `\n💡 برای ایجاد ماموریت جدید، ابتدا همه هزینه‌ها را تکمیل کنید.`;
          } else {
            message += `\n\n✅ همه هزینه‌های اسنپ تکمیل شد! حالا می‌توانید ماموریت جدید ایجاد کنید.`;
          }
        }

        await this.bot.sendMessage(chatId, message);
        return;
      }

      // ========== Handle newmission conversation ==========
      if (conversation.step === 'snapcost') {
        // اطمینان از وجود conversation.data
        if (!conversation.data) {
          conversation.data = {};
        }

        // بررسی اینکه آیا متن وارد شده یک عدد است
        const textTrimmed = text.trim();
        const snapCost = parseFloat(textTrimmed);
        
        // بررسی اینکه آیا عدد معتبر است
        if (isNaN(snapCost) || snapCost < 0 || !textTrimmed.match(/^\d+(\.\d+)?$/)) {
          await this.bot.sendMessage(chatId, '❌ لطفاً یک عدد معتبر وارد کنید (مثال: 50000 یا 50000.5)');
          return;
        }

        conversation.data.snapCost = snapCost;
        conversation.step = 'discountcode';
        this.conversations.set(chatId, conversation);

        // دریافت لیست کدهای تخفیف فعال
        const allDiscountCodes = await DiscountCode.getAll();
        const discountList = Array.isArray(allDiscountCodes) ? allDiscountCodes : [];
        console.log(`[Discount Code] Total discount codes: ${discountList.length}`, { raw: allDiscountCodes });
        console.log(`[Discount Code] All codes:`, discountList.map(c => ({ id: c.id, code: c.code, isActive: c.isActive })));
        
        const now = new Date();
        const activeDiscountCodes = discountList.filter(discount => {
          // بررسی فعال بودن
          if (!discount.isActive) {
            console.log(`[Discount Code] Code ${discount.code} (ID: ${discount.id}) is inactive`);
            return false;
          }
          
          // بررسی تاریخ اعتبار
          if (discount.validFrom) {
            const validFrom = new Date(discount.validFrom);
            if (now < validFrom) {
              console.log(`[Discount Code] Code ${discount.code} (ID: ${discount.id}) is not yet valid`);
              return false;
            }
          }
          if (discount.validUntil) {
            const validUntil = new Date(discount.validUntil);
            if (now > validUntil) {
              console.log(`[Discount Code] Code ${discount.code} (ID: ${discount.id}) has expired`);
              return false;
            }
          }
          
          // بررسی تعداد استفاده
          if (discount.maxUses && discount.currentUses >= discount.maxUses) {
            console.log(`[Discount Code] Code ${discount.code} (ID: ${discount.id}) has reached max uses (${discount.currentUses}/${discount.maxUses})`);
            return false;
          }
          
          console.log(`[Discount Code] Code ${discount.code} (ID: ${discount.id}) is active and valid`);
          return true;
        });

        console.log(`[Discount Code] Active discount codes: ${activeDiscountCodes.length}`);
        console.log(`[Discount Code] Active codes details:`, activeDiscountCodes.map(c => ({ id: c.id, code: c.code, type: c.discountType, value: c.discountValue })));

        // ساخت keyboard با لیست کدهای تخفیف
        const keyboard = [];
        
        console.log(`[Discount Code] Building keyboard for ${activeDiscountCodes.length} codes`);
        
        // نمایش کدهای تخفیف (یک کد در هر ردیف برای خوانایی بهتر)
        if (activeDiscountCodes.length > 0) {
          console.log(`[Discount Code] Processing ${activeDiscountCodes.length} active codes`);
          // نمایش هر کد در یک ردیف جداگانه
          activeDiscountCodes.forEach((discount, index) => {
            console.log(`[Discount Code] Processing code ${index + 1}/${activeDiscountCodes.length}:`, {
              id: discount.id,
              code: discount.code,
              type: discount.discountType,
              value: discount.discountValue
            });
            
            let label = discount.code || 'Unknown';
            if (discount.discountType === 'percentage') {
              label += ` (${discount.discountValue}%)`;
            } else {
              const valueStr = String(discount.discountValue || 0);
              label += ` (${valueStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} تومان)`;
            }
            
            // محدود کردن طول label به 64 کاراکتر (محدودیت تلگرام)
            if (label.length > 64) {
              label = label.substring(0, 61) + '...';
            }
            
            const callbackData = `select_discount_${discount.id}`;
            console.log(`[Discount Code] Adding button ${index + 1}: "${label}" -> "${callbackData}"`);
            
            keyboard.push([{
              text: label,
              callback_data: callbackData
            }]);
          });
          console.log(`[Discount Code] Added ${keyboard.length} code buttons to keyboard`);
        } else {
          console.log(`[Discount Code] No active codes found, only adding skip button`);
        }
        
        // دکمه رد کردن
        keyboard.push([{ text: '⏭️ رد کردن', callback_data: 'skip_discountcode' }]);
        console.log(`[Discount Code] Added skip button. Total keyboard rows: ${keyboard.length}`);

        console.log(`[Discount Code] Keyboard rows: ${keyboard.length}`);
        console.log(`[Discount Code] Keyboard structure:`, JSON.stringify(keyboard, null, 2));
        console.log(`[Discount Code] Active codes count: ${activeDiscountCodes.length}`);

        let message = `➕ ایجاد ماموریت جدید\n\n` +
          `✅ مرحله 2️⃣ تکمیل شد: هزینه اسنپ ${snapCost.toLocaleString('fa-IR')} تومان\n\n` +
          `مرحله 3️⃣: کد تخفیف (اختیاری)\n\n`;
        
        if (activeDiscountCodes.length > 0) {
          message += `📋 کدهای تخفیف فعال (${activeDiscountCodes.length} مورد):\n\n` +
            `لطفاً از لیست زیر انتخاب کنید یا کد را دستی وارد کنید:\n\n`;
        } else {
          message += `⚠️ هیچ کد تخفیف فعالی وجود ندارد.\n\n` +
            `لطفاً کد تخفیف را دستی وارد کنید یا رد کنید:\n\n`;
        }

        console.log(`[Discount Code] Sending message with ${keyboard.length} keyboard rows`);
        console.log(`[Discount Code] Message length: ${message.length}`);
        
        // بررسی اینکه keyboard خالی نیست
        if (keyboard.length === 0) {
          console.error(`[Discount Code] ERROR: Keyboard is empty!`);
          keyboard.push([{ text: '⏭️ رد کردن', callback_data: 'skip_discountcode' }]);
        }
        
        try {
          const sentMessage = await this.bot.sendMessage(chatId, message, {
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
          console.log(`[Discount Code] Message sent successfully. Message ID: ${sentMessage.message_id}`);
          console.log(`[Discount Code] Keyboard buttons count: ${keyboard.reduce((sum, row) => sum + row.length, 0)}`);
        } catch (error) {
          console.error(`[Discount Code] Error sending message:`, error);
          console.error(`[Discount Code] Error details:`, error.message);
          console.error(`[Discount Code] Error stack:`, error.stack);
          // Fallback: send message without keyboard if there's an error
          try {
            await this.bot.sendMessage(chatId, message + '\n⚠️ خطا در نمایش لیست کدهای تخفیف. لطفاً کد را دستی وارد کنید.');
          } catch (fallbackError) {
            console.error(`[Discount Code] Fallback message also failed:`, fallbackError);
          }
        }
      } else if (conversation.step === 'discountcode') {
        // اطمینان از وجود conversation.data
        if (!conversation.data) {
          conversation.data = {};
        }

        // بررسی کد تخفیف
        let discountCode = text.trim().toUpperCase(); // تبدیل به حروف بزرگ برای مقایسه بهتر
        if (discountCode) {
          console.log(`[Telegram Bot] Checking discount code: "${discountCode}"`);
          const discount = await DiscountCode.getByCode(discountCode);
          
          if (!discount) {
            // بررسی مجدد با حروف کوچک
            const discountLower = await DiscountCode.getByCode(discountCode.toLowerCase());
            if (discountLower) {
              discountCode = discountLower.code; // استفاده از کد اصلی از دیتابیس
              conversation.data.discountCode = discountCode;
              conversation.data.discountCodeId = discountLower.id;
              console.log(`[Telegram Bot] Discount code found (lowercase): ${discountCode}, ID: ${discountLower.id}`);
            } else {
              console.log(`[Telegram Bot] Discount code not found: "${discountCode}"`);
              await this.bot.sendMessage(chatId, '❌ کد تخفیف معتبر نیست. لطفاً دوباره وارد کنید یا رد کنید.');
              return;
            }
          } else {
            // ذخیره هم کد و هم ID
            discountCode = discount.code; // استفاده از کد اصلی از دیتابیس
            conversation.data.discountCode = discountCode;
            conversation.data.discountCodeId = discount.id;
            console.log(`[Telegram Bot] Discount code found: ${discountCode}, ID: ${discount.id}`);
          }
        }

        conversation.step = 'notes';
        this.conversations.set(chatId, conversation);

        await this.bot.sendMessage(chatId,
          `➕ ایجاد ماموریت جدید\n\n` +
          `✅ مرحله 3️⃣ تکمیل شد${discountCode ? `: کد تخفیف "${discountCode}"` : ': بدون کد تخفیف'}\n\n` +
          `مرحله 4️⃣: یادداشت (اختیاری)\n\n` +
          `لطفاً یادداشت یا توضیحات را وارد کنید یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '⏭️ رد کردن', callback_data: 'skip_notes' },
                { text: '✅ ثبت نهایی', callback_data: 'finish_mission' }
              ]]
            }
          }
        );
      } else if (conversation.step === 'manager_approve_comment') {
        // ذخیره یادداشت مدیر و تایید ماموریت
        const assignmentId = conversation.assignmentId;
        const managerComment = text;
        this.conversations.delete(chatId);
        
        await this.handleApprove(chatId, assignmentId, conversation.personnelId, managerComment);
        return;
      } else if (conversation.step === 'province_center_search') {
        const queryRaw = (msg.text || '').trim();
        const contactType = conversation.data?.contactType || 'province';
        if (!queryRaw) {
          await this.bot.sendMessage(chatId, '❌ عبارت جستجو نمی‌تواند خالی باشد. لطفاً دوباره تلاش کنید یا "لغو" را ارسال کنید.');
          return;
        }

        if (this.isCancelCommand(queryRaw)) {
          conversation.step = 'province_center_selection';
          this.conversations.set(chatId, conversation);
          await this.bot.sendMessage(chatId, '❌ جستجو لغو شد. لیست مراکز دوباره نمایش داده می‌شود.');
          if (contactType === 'tehran') {
            await this.showTehranCentersList(chatId, 0, conversation.data?.searchQuery || '');
          } else {
            await this.showProvinceCentersList(chatId, 0, conversation.data?.searchQuery || '');
          }
          return;
        }

        conversation.data.searchQuery = queryRaw;
        conversation.step = 'province_center_selection';
        this.conversations.set(chatId, conversation);
        if (contactType === 'tehran') {
          await this.showTehranCentersList(chatId, 0, queryRaw);
        } else {
          await this.showProvinceCentersList(chatId, 0, queryRaw);
        }
        return;
      } else if (conversation.step === 'province_contact_note') {
        // ذخیره یادداشت تماس استان‌ها یا تهران
        if (!conversation.data) {
          conversation.data = {};
        }
        
        // اگر کاربر "رد" یا "لغو" تایپ کرد، همانند دکمه عمل می‌کند
        if (text.toLowerCase().trim() === 'رد' || text.toLowerCase().trim() === 'لغو') {
          conversation.data.contactNote = null;
        } else {
          conversation.data.contactNote = text.trim();
        }

        // نمایش منوی تغییر وضعیت
        conversation.step = 'province_change_status';
        this.conversations.set(chatId, conversation);

        const center = await Center.getById(conversation.data.selectedCenterId);
        const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
        
        // خواندن برچسب‌ها از مرکز
        let centerTags = [];
        if (center && center.tags) {
          if (Array.isArray(center.tags)) {
            centerTags = center.tags;
          } else if (typeof center.tags === 'string') {
            try {
              centerTags = JSON.parse(center.tags);
              if (!Array.isArray(centerTags)) {
                centerTags = [];
              }
            } catch (e) {
              centerTags = [];
            }
          }
        }
        
        // اگر برچسبی نداشت، از type استفاده کن
        const currentStatus = centerTags.length > 0 ? centerTags[0] : (center?.type || 'lead');
        
        const mapStatusLabel = (status) => {
          const labels = {
            'lead': 'سرنخ',
            'opportunity': 'فرصت',
            'customer': 'مشتری',
            'old_customer': 'مشتری قدیمی'
          };
          return labels[status] || status;
        };
        
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔵 سرنخ', callback_data: 'province_status_lead' },
                { text: '🟢 فرصت', callback_data: 'province_status_opportunity' }
              ],
              [
                { text: '🟡 مشتری', callback_data: 'province_status_customer' },
                { text: '🟠 مشتری قدیمی', callback_data: 'province_status_old_customer' }
              ],
              [
                { text: '⏭️ بدون تغییر', callback_data: 'province_status_skip' }
              ]
            ]
          }
        };

        const timelineText = await this.getCenterStatusTimelineText(center?.id);
        
        let message = `📞 *ثبت تماس*\n\n` +
          `🏢 مرکز: ${centerName}\n` +
          `📝 یادداشت: ${conversation.data.contactNote || '(بدون یادداشت)'}\n\n` +
          `📊 وضعیت فعلی: ${mapStatusLabel(currentStatus)}\n\n`;

        if (timelineText) {
          message += `${timelineText}\n\n`;
        }

        message += `لطفاً وضعیت جدید مرکز را انتخاب کنید:`;
        
        await this.bot.sendMessage(chatId,
          message,
          { ...keyboard, parse_mode: 'Markdown' }
        );
        return;
      } else if (conversation.step === 'notes') {
        // اطمینان از وجود conversation.data
        if (!conversation.data) {
          conversation.data = {};
        }

        conversation.data.notes = text;
        this.conversations.set(chatId, conversation);
        await this.finishMission(chatId, conversation);
      }

      // ========== Handle complete center conversation ==========
      if (conversation.step === 'center_address') {
        conversation.data.address = text;
        conversation.step = 'center_city';
        this.conversations.set(chatId, conversation);

        await this.bot.sendMessage(chatId,
          `✅ مرحله 1️⃣ تکمیل شد: آدرس "${text}" ثبت شد\n\n` +
          `مرحله 2️⃣: شهر\n\n` +
          `لطفاً نام شهر را وارد کنید:`
        );
        return;
      }

      if (conversation.step === 'center_city') {
        conversation.data.city = text;
        conversation.step = 'center_district';
        this.conversations.set(chatId, conversation);

        await this.bot.sendMessage(chatId,
          `✅ مرحله 2️⃣ تکمیل شد: شهر "${text}" ثبت شد\n\n` +
          `مرحله 3️⃣: منطقه\n\n` +
          `لطفاً نام منطقه را وارد کنید (اختیاری):\n\n` +
          `یا برای رد کردن این مرحله، از دکمه زیر استفاده کنید:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '⏭️ رد کردن', callback_data: 'skip_district' }
              ]]
            }
          }
        );
        return;
      }

      if (conversation.step === 'center_district') {
        conversation.data.district = text;
        conversation.step = 'center_finish';
        this.conversations.set(chatId, conversation);

        // نمایش خلاصه و ذخیره
        const center = Center.getById(conversation.centerId);
        const updateData = {
          address: conversation.data.address,
          city: conversation.data.city,
          district: conversation.data.district || null
        };

        Center.update(conversation.centerId, updateData);
        this.conversations.delete(chatId);

        const centerName = (center.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
        let message = `✅ اطلاعات مرکز تکمیل شد!\n\n`;
        message += `🏢 مرکز: ${centerName}\n`;
        message += `📍 آدرس: ${updateData.address}\n`;
        message += `🏙️ شهر: ${updateData.city}\n`;
        if (updateData.district) {
          message += `📌 منطقه: ${updateData.district}\n`;
        }

        await this.bot.sendMessage(chatId, message);
        return;
      }

    } catch (error) {
      console.error('Error in handleConversationMessage:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      this.conversations.delete(chatId);
    }
  }

  // Helper: تکمیل افزودن مرکز
  async finishAddCenter(chatId, conversation) {
    try {
      const { name, type, address, city, district, responsiblePersonnelId } = conversation.data;
      
      if (!name || !type || !address || !city) {
        await this.bot.sendMessage(chatId, '❌ اطلاعات ناقص است. لطفاً دوباره از /add شروع کنید.');
        this.conversations.delete(chatId);
        return;
      }

      const center = Center.create({
        name,
        type,
        address,
        city,
        district: district || null,
        responsiblePersonnelId: responsiblePersonnelId || null
      });

      this.conversations.delete(chatId);

      const centerName = (center.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const typeLabels = {
        'lead': 'سرنخ',
        'opportunity': 'فرصت',
        'customer': 'مشتری',
        'old_customer': 'مشتری قدیمی'
      };
      
      let message = `✅ مرکز با موفقیت اضافه شد!\n\n`;
      message += `🏢 نام: ${centerName}\n`;
      message += `📌 نوع: ${typeLabels[type] || type}\n`;
      message += `📍 آدرس: ${address}\n`;
      message += `🏙️ شهر: ${city}\n`;
      if (district) {
        message += `📌 منطقه: ${district}\n`;
      }
      if (responsiblePersonnelId) {
        const responsiblePersonnel = Personnel.getById(responsiblePersonnelId);
        if (responsiblePersonnel) {
          message += `👤 مسئول: ${responsiblePersonnel.name}\n`;
        }
      }

      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Error in finishAddCenter:', error);
      await this.bot.sendMessage(chatId, `❌ خطا در افزودن مرکز: ${error.message}`);
      this.conversations.delete(chatId);
    }
  }
  // Helper: تبدیل تاریخ به شمسی با فرمت زیبا
  formatPersianDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const jalaali = toJalaali(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      
      const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      
      return `${jalaali.jd} ${monthNames[jalaali.jm - 1]} ${jalaali.jy}`;
    } catch (error) {
      return dateString;
    }
  }
  // Helper: نمایش لیست ماموریت‌ها با Pagination (بهبود یافته)
  async showMissionsList(chatId, assignments, page = 0, callbackPrefix = 'missions_page') {
    const missionsPerPage = 10;
    const totalPages = Math.ceil(assignments.length / missionsPerPage);
    const missionsToShow = assignments.slice(page * missionsPerPage, (page + 1) * missionsPerPage);

    let message = `📋 *ماموریت‌های شما*\n\n`;
    message += `📊 *آمار:* ${assignments.length} ماموریت | صفحه ${page + 1} از ${totalPages}\n\n`;
    
    if (missionsToShow.length === 0) {
      message += `❌ هیچ ماموریتی یافت نشد.`;
    } else {
      missionsToShow.forEach((assignment, index) => {
        const globalIndex = page * missionsPerPage + index;
        const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
        const statusLabel = this.getStatusLabel(assignment.status);
        const dateStr = assignment.createdAt ? this.formatPersianDate(assignment.createdAt) : '';
        
        message += `*${globalIndex + 1}. ماموریت #${assignment.id}*\n`;
        message += `   📍 مرکز: ${centerName}\n`;
        message += `   ${statusLabel}\n`;
        if (dateStr) {
          message += `   📅 تاریخ: ${dateStr}\n`;
        }
        if (assignment.totalCost) {
          message += `   💰 هزینه: ${assignment.totalCost.toLocaleString('fa-IR')} تومان\n`;
        }
        message += `   /status_${assignment.id}\n\n`;
      });
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: []
      }
    };

    // دکمه‌های navigation بهبود یافته
    const navButtons = [];
    if (totalPages > 1) {
      if (page > 0) {
        navButtons.push({ text: '⏮️ اول', callback_data: `${callbackPrefix}_0` });
        navButtons.push({ text: '⬅️ قبلی', callback_data: `${callbackPrefix}_${page - 1}` });
      }
      if (page < totalPages - 1) {
        navButtons.push({ text: '➡️ بعدی', callback_data: `${callbackPrefix}_${page + 1}` });
        navButtons.push({ text: '⏭️ آخر', callback_data: `${callbackPrefix}_${totalPages - 1}` });
      }
    }
    
    if (navButtons.length > 0) {
      keyboard.reply_markup.inline_keyboard.push(navButtons);
    }

    // اضافه کردن دکمه بازگشت به منو
    this.addBackToMenuButton(keyboard);

    await this.bot.sendMessage(chatId, message, { 
      ...keyboard,
      parse_mode: 'Markdown'
    });
  }

  // Helper: getStatusLabel with emoji
  getStatusLabel(status) {
    const labels = {
      'pending': '⏳ در انتظار',
      'approved': '✅ تایید شده',
      'in-progress': '🔄 در حال انجام',
      'completed': '✔️ تکمیل شده',
      'rejected': '❌ رد شده',
      'cancelled': '🚫 لغو شده'
    };
    return labels[status] || status;
  }

  // Helper: اضافه کردن دکمه "بازگشت به منو" به keyboard
  addBackToMenuButton(keyboard) {
    if (!keyboard.reply_markup) {
      keyboard.reply_markup = { inline_keyboard: [] };
    }
    if (!keyboard.reply_markup.inline_keyboard) {
      keyboard.reply_markup.inline_keyboard = [];
    }
    // اضافه کردن دکمه بازگشت به منو در انتها
    keyboard.reply_markup.inline_keyboard.push([
      { text: '🏠 بازگشت به منو', callback_data: 'menu_back_to_main' }
    ]);
    return keyboard;
  }
  // Helper: نمایش پیام loading
  async showLoadingMessage(chatId, text = '⏳ در حال پردازش...') {
    try {
      const loadingMsg = await this.bot.sendMessage(chatId, text);
      return loadingMsg.message_id;
    } catch (error) {
      console.error('Error showing loading message:', error);
      return null;
    }
  }

  // Helper: حذف پیام loading
  async deleteLoadingMessage(chatId, messageId) {
    try {
      if (messageId) {
        await this.bot.deleteMessage(chatId, messageId);
      }
    } catch (error) {
      // Ignore errors - message might already be deleted
    }
  }

  // Helper: نمایش پیام با Markdown format
  async handleAddSnapCost(chatId, assignmentId, telegramId) {
    try {
      const assignment = await AssignmentModel.getById(parseInt(assignmentId));
      if (!assignment) {
        await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
        return;
      }

      let requester = null;
      if (telegramId) {
        requester = await Personnel.getByTelegramId(telegramId);
        if (!requester) {
          await this.bot.sendMessage(chatId, '❌ شناسه تلگرام شما در سیستم ثبت نشده است.');
          return;
        }
      }

      const isManager = requester && (requester.role === 'admin' || requester.role === 'manager');
      if (requester && !isManager && parseInt(requester.id) !== parseInt(assignment.personnelId)) {
        await this.bot.sendMessage(chatId, '❌ فقط صاحب ماموریت یا مدیر می‌تواند هزینه اسنپ را ثبت کند.');
        return;
      }

      const center = assignment.centerId ? await Center.getById(assignment.centerId) : null;
      const centerName = center?.name || assignment.centerName || 'نامشخص';

      this.conversations.set(chatId, {
        step: 'add_snapcost',
        assignmentId: assignment.id,
        personnelId: assignment.personnelId,
        data: {
          centerName
        }
      });

      let message = `💰 ثبت هزینه اسنپ\n\n`;
      message += `📋 ماموریت #${assignment.id}\n`;
      message += `🏢 مرکز: ${centerName}\n`;
      if (assignment.snapCost) {
        message += `ℹ️ هزینه فعلی: ${Number(assignment.snapCost).toLocaleString('fa-IR')} تومان\n`;
      }
      message += `\nلطفاً مبلغ هزینه اسنپ را به تومان وارد کنید.`;

      await this.bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ بعداً انجام می‌دهم', callback_data: 'skip_add_snapcost' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in handleAddSnapCost:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  cloneSimpleObject(obj) {
    if (!obj) {
      return {};
    }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      return { ...obj };
    }
  }

  escapeMarkdown(text) {
    if (!text) return '';
    // Escape characters for MarkdownV2
    return String(text)
      .replace(/\_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\~/g, '\\~')
      .replace(/\`/g, '\\`')
      .replace(/\>/g, '\\>')
      .replace(/\#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\-')
      .replace(/\=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/\!/g, '\\!');
  }
  // Helper: skip snap cost
  async handleSkipSnapCost(chatId) {
    try {
      const conversation = this.conversations.get(chatId);
      if (!conversation) {
        await this.bot.sendMessage(chatId, '❌ لطفاً از /newmission شروع کنید.');
        return;
      }

      if (!conversation.data) {
        conversation.data = {};
      }

      conversation.data.snapCost = null;
      conversation.step = 'discountcode';
      this.conversations.set(chatId, conversation);

      // دریافت لیست کدهای تخفیف فعال
      const allDiscountCodes = await DiscountCode.getAll();
      const discountList = Array.isArray(allDiscountCodes) ? allDiscountCodes : [];
      console.log(`[Discount Code] [Skip SnapCost] Total discount codes: ${discountList.length}`, { raw: allDiscountCodes });
      console.log(`[Discount Code] [Skip SnapCost] All codes:`, discountList.map(c => ({ id: c.id, code: c.code, isActive: c.isActive })));
      
      const now = new Date();
      const activeDiscountCodes = discountList.filter(discount => {
        // بررسی فعال بودن
        if (!discount.isActive) {
          console.log(`[Discount Code] [Skip SnapCost] Code ${discount.code} (ID: ${discount.id}) is inactive`);
          return false;
        }
        
        // بررسی تاریخ اعتبار
        if (discount.validFrom) {
          const validFrom = new Date(discount.validFrom);
          if (now < validFrom) {
            console.log(`[Discount Code] [Skip SnapCost] Code ${discount.code} (ID: ${discount.id}) is not yet valid`);
            return false;
          }
        }
        if (discount.validUntil) {
          const validUntil = new Date(discount.validUntil);
          if (now > validUntil) {
            console.log(`[Discount Code] [Skip SnapCost] Code ${discount.code} (ID: ${discount.id}) has expired`);
            return false;
          }
        }
        
        // بررسی تعداد استفاده
        if (discount.maxUses && discount.currentUses >= discount.maxUses) {
          console.log(`[Discount Code] [Skip SnapCost] Code ${discount.code} (ID: ${discount.id}) has reached max uses (${discount.currentUses}/${discount.maxUses})`);
          return false;
        }
        
        console.log(`[Discount Code] [Skip SnapCost] Code ${discount.code} (ID: ${discount.id}) is active and valid`);
        return true;
      });

      console.log(`[Discount Code] [Skip SnapCost] Active discount codes: ${activeDiscountCodes.length}`);
      console.log(`[Discount Code] [Skip SnapCost] Active codes details:`, activeDiscountCodes.map(c => ({ id: c.id, code: c.code, type: c.discountType, value: c.discountValue })));

      // ساخت keyboard با لیست کدهای تخفیف
      const keyboard = [];
      
      console.log(`[Discount Code] [Skip SnapCost] Building keyboard for ${activeDiscountCodes.length} codes`);
      
      // نمایش کدهای تخفیف (یک کد در هر ردیف برای خوانایی بهتر)
      if (activeDiscountCodes.length > 0) {
        console.log(`[Discount Code] [Skip SnapCost] Processing ${activeDiscountCodes.length} active codes`);
        // نمایش هر کد در یک ردیف جداگانه
        activeDiscountCodes.forEach((discount, index) => {
          console.log(`[Discount Code] [Skip SnapCost] Processing code ${index + 1}/${activeDiscountCodes.length}:`, {
            id: discount.id,
            code: discount.code,
            type: discount.discountType,
            value: discount.discountValue
          });
          
          let label = discount.code || 'Unknown';
          if (discount.discountType === 'percentage') {
            label += ` (${discount.discountValue}%)`;
          } else {
            const valueStr = String(discount.discountValue || 0);
            label += ` (${valueStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} تومان)`;
          }
          
          // محدود کردن طول label به 64 کاراکتر (محدودیت تلگرام)
          if (label.length > 64) {
            label = label.substring(0, 61) + '...';
          }
          
          const callbackData = `select_discount_${discount.id}`;
          console.log(`[Discount Code] [Skip SnapCost] Adding button ${index + 1}: "${label}" -> "${callbackData}"`);
          
          keyboard.push([{
            text: label,
            callback_data: callbackData
          }]);
        });
        console.log(`[Discount Code] [Skip SnapCost] Added ${keyboard.length} code buttons to keyboard`);
      } else {
        console.log(`[Discount Code] [Skip SnapCost] No active codes found, only adding skip button`);
      }
      
      // دکمه رد کردن
      keyboard.push([{ text: '⏭️ رد کردن', callback_data: 'skip_discountcode' }]);
      console.log(`[Discount Code] [Skip SnapCost] Added skip button. Total keyboard rows: ${keyboard.length}`);

      console.log(`[Discount Code] [Skip SnapCost] Keyboard rows: ${keyboard.length}`);
      console.log(`[Discount Code] [Skip SnapCost] Keyboard structure:`, JSON.stringify(keyboard, null, 2));
      console.log(`[Discount Code] [Skip SnapCost] Active codes count: ${activeDiscountCodes.length}`);

      let message = `➕ ایجاد ماموریت جدید\n\n` +
        `✅ مرحله 2️⃣ رد شد\n\n` +
        `مرحله 3️⃣: کد تخفیف (اختیاری)\n\n`;
      
      if (activeDiscountCodes.length > 0) {
        message += `📋 کدهای تخفیف فعال (${activeDiscountCodes.length} مورد):\n\n` +
          `لطفاً از لیست زیر انتخاب کنید یا کد را دستی وارد کنید:\n\n`;
      } else {
        message += `⚠️ هیچ کد تخفیف فعالی وجود ندارد.\n\n` +
          `لطفاً کد تخفیف را دستی وارد کنید یا رد کنید:\n\n`;
      }

      console.log(`[Discount Code] [Skip SnapCost] Sending message with ${keyboard.length} keyboard rows`);
      console.log(`[Discount Code] [Skip SnapCost] Message length: ${message.length}`);
      
      // بررسی اینکه keyboard خالی نیست
      if (keyboard.length === 0) {
        console.error(`[Discount Code] [Skip SnapCost] ERROR: Keyboard is empty!`);
        keyboard.push([{ text: '⏭️ رد کردن', callback_data: 'skip_discountcode' }]);
      }
      
      try {
        const sentMessage = await this.bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
        console.log(`[Discount Code] [Skip SnapCost] Message sent successfully. Message ID: ${sentMessage.message_id}`);
        console.log(`[Discount Code] [Skip SnapCost] Keyboard buttons count: ${keyboard.reduce((sum, row) => sum + row.length, 0)}`);
      } catch (error) {
        console.error(`[Discount Code] [Skip SnapCost] Error sending message:`, error);
        console.error(`[Discount Code] [Skip SnapCost] Error details:`, error.message);
        console.error(`[Discount Code] [Skip SnapCost] Error stack:`, error.stack);
        // Fallback: send message without keyboard if there's an error
        try {
          await this.bot.sendMessage(chatId, message + '\n⚠️ خطا در نمایش لیست کدهای تخفیف. لطفاً کد را دستی وارد کنید.');
        } catch (fallbackError) {
          console.error(`[Discount Code] [Skip SnapCost] Fallback message also failed:`, fallbackError);
        }
      }
    } catch (error) {
      console.error('Error in handleSkipSnapCost:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // Helper: finish mission
  async finishMission(chatId, conversation) {
    try {
      // اطمینان از وجود conversation.data
      if (!conversation.data) {
        conversation.data = {};
      }

      const { selectedCenters, snapCost, discountCode, discountCodeId, notes } = conversation.data;
      const { personnelId } = conversation;

      if (!selectedCenters || selectedCenters.length === 0) {
        await this.bot.sendMessage(chatId, '❌ مرکز انتخاب نشده است.');
        this.conversations.delete(chatId);
        return;
      }

      // بررسی مجدد قبل از ایجاد ماموریت - اطمینان از اینکه هزینه‌های قبلی ثبت شده‌اند
      const personnel = personnelId ? await Personnel.getById(personnelId) : null;
      const companyCenter = await this.getOrCreateCompanyCenter();
      const companyCenterId = companyCenter ? parseInt(companyCenter.id) : null;

      if (personnel) {
        const allAssignments = await AssignmentModel.getAll({ personnelId: parseInt(personnel.id) });
        const incompleteSnapCost = allAssignments.filter(a => {
          if (companyCenterId && parseInt(a.centerId) === companyCenterId) {
            return false;
          }
          const snapCostValue = a.snapCost;
          // تبدیل به number برای مقایسه
          const snapCostNum = snapCostValue === null || snapCostValue === undefined ? 0 : Number(snapCostValue);
          const hasNoSnapCost = this.isSnapCostMissing(snapCostValue);
          return (a.status === 'approved' || a.status === 'completed') && hasNoSnapCost;
        });
        
        console.log(`🔍 Final check before creating mission for personnel ${personnel.id}:`);
        console.log(`   Total assignments: ${allAssignments.length}`);
        console.log(`   Incomplete snap costs found: ${incompleteSnapCost.length}`);
        if (incompleteSnapCost.length > 0) {
          incompleteSnapCost.forEach(a => {
            console.log(`   - Incomplete: Assignment #${a.id}: status=${a.status}, snapCost=${a.snapCost} (type: ${typeof a.snapCost})`);
          });
        }

        if (incompleteSnapCost.length > 0) {
          // اگر هنوز هزینه‌های ثبت نشده وجود دارد، اجازه ایجاد ماموریت جدید نمی‌دهیم
          console.log(`❌ Blocking mission creation - ${incompleteSnapCost.length} incomplete snap costs found`);
          const maxVisible = 10;
          const visibleAssignments = incompleteSnapCost.slice(0, maxVisible);

          let message = `⚠️ هنوز ماموریت‌های بدون هزینه اسنپ وجود دارد!\n\n`;
          message += `شما ${incompleteSnapCost.length} ماموریت دارید که هزینه اسنپ آن‌ها ثبت نشده است.\n\n`;
          message += `❌ برای ایجاد ماموریت جدید، ابتدا باید هزینه اسنپ همه ماموریت‌های قبلی را تکمیل کنید.\n\n`;
          message += `📋 ماموریت‌های بدون هزینه اسنپ:\n\n`;

          visibleAssignments.forEach((assignment, index) => {
            const centerName = (assignment.centerName || 'نامشخص').replace(/[*_`\[\]()]/g, '');
            message += `${index + 1}. ماموریت #${assignment.id} - ${centerName}\n`;
          });

          if (incompleteSnapCost.length > visibleAssignments.length) {
            message += `\nو ${incompleteSnapCost.length - visibleAssignments.length} ماموریت دیگر...\n`;
          }

          message += `\n💡 برای تکمیل هزینه اسنپ، روی هر ماموریت زیر کلیک کنید یا از /status_<id> استفاده کنید.`;

          const inlineKeyboard = [];
          visibleAssignments.forEach((assignment, index) => {
            if (index % 2 === 0) {
              inlineKeyboard.push([]);
            }
            inlineKeyboard[inlineKeyboard.length - 1].push({
              text: `ماموریت #${assignment.id}`,
              callback_data: `status_${assignment.id}`
            });
          });

          if (inlineKeyboard.length === 0) {
            inlineKeyboard.push([{ text: 'باز کردن وضعیت‌ها', callback_data: 'menu_missions' }]);
          } else {
            inlineKeyboard.push([{ text: '📋 ماموریت‌های من', callback_data: 'menu_missions' }]);
          }

          this.conversations.delete(chatId);
          await this.bot.sendMessage(chatId, message, {
            reply_markup: {
              inline_keyboard: inlineKeyboard
            }
          });
          console.log(`✅ Mission creation blocked - message sent to user`);
          return;
        }
        
        console.log(`✅ No incomplete snap costs - proceeding with mission creation`);
      }

      // ایجاد ماموریت برای هر مرکز
      const createdAssignments = [];
      const errors = [];
      
      for (const centerId of selectedCenters) {
        try {
          // بررسی صحت داده‌ها قبل از ایجاد
          if (!personnelId) {
            throw new Error('شناسه پرسنل نامعتبر است');
          }
          
          const parsedPersonnelId = parseInt(personnelId);
          const parsedCenterId = parseInt(centerId);
          
          if (isNaN(parsedPersonnelId)) {
            throw new Error(`شناسه پرسنل نامعتبر: ${personnelId}`);
          }
          
          if (isNaN(parsedCenterId)) {
            throw new Error(`شناسه مرکز نامعتبر: ${centerId}`);
          }
          
          // بررسی وجود پرسنل
          const personnel = await Personnel.getById(parsedPersonnelId);
          if (!personnel) {
            throw new Error(`پرسنل با شناسه ${parsedPersonnelId} یافت نشد`);
          }
          
          // بررسی وجود مرکز
          const center = await Center.getById(parsedCenterId);
          if (!center) {
            throw new Error(`مرکز با شناسه ${parsedCenterId} یافت نشد`);
          }
          
          const assignment = await AssignmentModel.create({
            personnelId: parsedPersonnelId,
            centerId: parsedCenterId,
            snapCost: snapCost ? parseFloat(snapCost) : null,
            discountCode: discountCode || null,
            discountCodeId: discountCodeId ? parseInt(discountCodeId) : null,
            notes: notes || null, // فقط یک یادداشت واحد که هم برای مدیر ارسال می‌شود و هم در داشبورد نمایش داده می‌شود
            centerNotes: null // حذف centerNotes
          });
          
          if (assignment) {
            createdAssignments.push(assignment);
          } else {
            throw new Error('ماموریت ایجاد نشد (نتیجه null)');
          }
        } catch (error) {
          const centerName = await Center.getById(parseInt(centerId)).then(c => c?.name || `مرکز #${centerId}`).catch(() => `مرکز #${centerId}`);
          const errorMessage = error.message || error.toString();
          console.error(`Error creating assignment for center ${centerId} (${centerName}):`, error);
          console.error('Error stack:', error.stack);
          errors.push({
            centerId,
            centerName,
            error: errorMessage
          });
        }
      }

      // حذف conversation
      this.conversations.delete(chatId);

      // ارسال پیام نتیجه
      if (createdAssignments.length > 0) {
        const center = await Center.getById(parseInt(selectedCenters[0])).catch(() => null);
        const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
        let message = `✅ ${createdAssignments.length} ماموریت با موفقیت ایجاد شد!\n\n`;
        message += `📋 کدهای ماموریت: ${createdAssignments.map(a => `#${a.id}`).join(', ')}\n`;
        if (createdAssignments.length === 1) {
          message += `🏢 مرکز: ${centerName}\n`;
        } else {
          message += `🏢 تعداد مراکز: ${createdAssignments.length}\n`;
        }
        
        const firstAssignment = createdAssignments[0];
        if (firstAssignment.totalCost) {
          message += `💰 هزینه کل: ${firstAssignment.totalCost.toLocaleString('fa-IR')} تومان\n`;
        }
        message += `📊 وضعیت: ${this.getStatusLabel(firstAssignment.status)}\n\n`;
        message += `💡 ماموریت شما برای تایید مدیر ارسال شد. پس از تایید، به شما اطلاع داده می‌شود.`;

        await this.bot.sendMessage(chatId, message);

        // اطلاع‌رسانی به مدیران
        for (const assignment of createdAssignments) {
          await this.notifyNewAssignment(assignment);
        }
        
        // اگر خطاهایی وجود داشت، به کاربر اطلاع بده
        if (errors.length > 0) {
          let errorMessage = `\n⚠️ توجه: ${errors.length} ماموریت با خطا مواجه شد:\n\n`;
          errors.forEach((err, index) => {
            errorMessage += `${index + 1}. ${err.centerName}: ${err.error}\n`;
          });
          await this.bot.sendMessage(chatId, errorMessage);
        }
      } else {
        // همه ماموریت‌ها با خطا مواجه شدند
        let errorMessage = '❌ خطا در ایجاد ماموریت.\n\n';
        if (errors.length > 0) {
          errorMessage += 'جزئیات خطاها:\n\n';
          errors.forEach((err, index) => {
            errorMessage += `${index + 1}. ${err.centerName}: ${err.error}\n`;
          });
        } else {
          errorMessage += 'لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.';
        }
        await this.bot.sendMessage(chatId, errorMessage);
      }
    } catch (error) {
      console.error('Error in finishMission:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
      this.conversations.delete(chatId);
    }
  }

  // Helper: handle status command
  async handleStatusCommand(chatId, assignmentId, telegramId) {
    try {
      const personnel = await Personnel.getByTelegramId(telegramId);
      if (!personnel) {
        await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
        return;
      }

      const assignment = await AssignmentModel.getById(assignmentId);
      if (!assignment) {
        await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
        return;
      }

      // بررسی دسترسی: فقط پرسنل مربوطه یا مدیران می‌توانند ببینند
      const isManager = personnel.role === 'admin' || personnel.role === 'manager';
      if (!isManager && parseInt(assignment.personnelId) !== parseInt(personnel.id)) {
        await this.bot.sendMessage(chatId, '❌ شما دسترسی به این ماموریت ندارید.');
        return;
      }

      const center = await Center.getById(assignment.centerId);
      const assignmentPersonnel = await Personnel.getById(assignment.personnelId);
      const manager = assignment.managerId ? await Personnel.getById(assignment.managerId) : null;

      const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const personnelName = (assignmentPersonnel?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const managerName = manager ? (manager.name || 'نامشخص').replace(/[*_`\[\]()]/g, '') : null;

      let message = `📋 جزئیات ماموریت #${assignment.id}\n\n`;
      message += `👤 پرسنل: ${personnelName}\n`;
      message += `🏢 مرکز: ${centerName}\n`;
      message += `📊 وضعیت: ${this.getStatusLabel(assignment.status)}\n`;
      if (assignment.createdAt) {
        message += `📅 تاریخ ایجاد: ${this.formatPersianDate(assignment.createdAt)}\n`;
      }
      if (assignment.snapCost) {
        message += `💰 هزینه اسنپ: ${assignment.snapCost.toLocaleString('fa-IR')} تومان\n`;
      }
      if (assignment.discountCode) {
        message += `🎫 کد تخفیف: ${assignment.discountCode}\n`;
      }
      if (assignment.discountAmount) {
        message += `🎁 مبلغ تخفیف: ${assignment.discountAmount.toLocaleString('fa-IR')} تومان\n`;
      }
      if (assignment.totalCost) {
        message += `💵 هزینه کل: ${assignment.totalCost.toLocaleString('fa-IR')} تومان\n`;
      }
      if (assignment.personalPayment > 0) {
        message += `💳 پرداخت شخصی: ${assignment.personalPayment.toLocaleString('fa-IR')} تومان\n`;
      }
      if (managerName) {
        message += `👤 تایید کننده: ${managerName}\n`;
      }
      if (assignment.approvedAt) {
        message += `📅 تاریخ تایید: ${this.formatPersianDate(assignment.approvedAt)}\n`;
      }
      if (assignment.completedAt) {
        message += `✅ تاریخ تکمیل: ${this.formatPersianDate(assignment.completedAt)}\n`;
      }
      if (assignment.notes) {
        const notes = (assignment.notes || '').replace(/[*_`\[\]()]/g, '');
        message += `📝 یادداشت: ${notes}\n`;
      }

      // دکمه ویرایش (فقط برای صاحب ماموریت یا مدیران)
      const keyboard = {
        reply_markup: {
          inline_keyboard: []
        }
      };

      // اگر صاحب ماموریت است یا مدیر است، دکمه ویرایش اضافه کن
      if (parseInt(assignment.personnelId) === parseInt(personnel.id) || isManager) {
        keyboard.reply_markup.inline_keyboard.push([
          { text: '✏️ ویرایش', callback_data: `edit_assignment_${assignmentId}` }
        ]);
      }

      // دکمه حذف (فقط برای مدیران)
      if (isManager) {
        keyboard.reply_markup.inline_keyboard.push([
          { text: '🗑️ حذف ماموریت', callback_data: `delete_assignment_${assignmentId}` }
        ]);
      }

      await this.bot.sendMessage(chatId, message, keyboard);
    } catch (error) {
      console.error('Error in handleStatusCommand:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // Helper: notify new assignment to managers
  async notifyNewAssignment(assignment) {
    try {
      const allPersonnel = await Personnel.getAll();
      const managers = allPersonnel.filter(p => p.role === 'admin' || p.role === 'manager');
      const personnel = await Personnel.getById(assignment.personnelId);
      const center = await Center.getById(assignment.centerId);
      
      const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const personnelName = (personnel?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      
      for (const manager of managers) {
        if (manager.telegramId) {
          try {
            let message = `🔔 ماموریت جدید در انتظار تایید\n\n` +
              `👤 پرسنل: ${personnelName}\n` +
              `🏢 مرکز: ${centerName}\n`;
            
            // اضافه کردن یادداشت اگر وجود داشته باشد
            if (assignment.notes) {
              const notes = assignment.notes.replace(/[*_`\[\]()]/g, '');
              message += `📝 یادداشت: ${notes}\n`;
            }
            
            message += `💰 هزینه کل: ${(assignment.totalCost || 0).toLocaleString('fa-IR')} تومان\n` +
              `📋 کد ماموریت: #${assignment.id}\n`;

            const keyboard = {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ تایید', callback_data: `approve_${assignment.id}` },
                    { text: '❌ رد', callback_data: `reject_${assignment.id}` }
                  ],
                  [
                    { text: '📋 جزئیات', callback_data: `status_${assignment.id}` }
                  ]
                ]
              }
            };
            
            await this.bot.sendMessage(manager.telegramId, message, keyboard);
          } catch (error) {
            console.error(`Error notifying manager ${manager.name}:`, error.message);
          }
        }
      }

      // اطلاع‌رسانی به پرسنل
      if (personnel?.telegramId) {
        try {
          await this.bot.sendMessage(personnel.telegramId,
            `✅ ماموریت شما ثبت شد\n\n` +
            `📋 کد ماموریت: #${assignment.id}\n` +
            `🏢 مرکز: ${centerName}\n` +
            `📊 وضعیت: ${this.getStatusLabel(assignment.status)}\n\n` +
            `💡 ماموریت شما برای تایید مدیر ارسال شد.`
          );
        } catch (error) {
          console.error(`Error notifying personnel:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error in notifyNewAssignment:', error);
    }
  }

  // Helper: handle approve assignment
  async handleApprove(chatId, assignmentId, telegramId, managerComment = null) {
    try {
      const personnel = await Personnel.getByTelegramId(telegramId);
      if (!personnel) {
        await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
        return;
      }

      const isManager = personnel.role === 'admin' || personnel.role === 'manager';
      if (!isManager) {
        await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند ماموریت‌ها را تایید کنند.');
        return;
      }

      const assignment = await AssignmentModel.getById(assignmentId);
      if (!assignment) {
        await this.bot.sendMessage(chatId, '❌ ماموریت یافت نشد.');
        return;
      }

      if (assignment.status !== 'pending') {
        await this.bot.sendMessage(chatId, `❌ این ماموریت در وضعیت "${this.getStatusLabel(assignment.status)}" است و نمی‌توان آن را تایید کرد.`);
        return;
      }

      // تایید ماموریت
      console.log(`✅ Approving assignment #${assignmentId} by manager ${personnel.name} (ID: ${personnel.id})`);
      
      const updatedAssignment = await AssignmentModel.approve(assignmentId, parseInt(personnel.id), undefined, managerComment);

      if (!updatedAssignment) {
        console.error(`❌ Failed to approve assignment #${assignmentId}`);
        await this.bot.sendMessage(chatId, '❌ خطا در تایید ماموریت. لطفاً دوباره تلاش کنید.');
        return;
      }

      console.log(`✅ Assignment #${assignmentId} approved successfully. New status: ${updatedAssignment.status}`);
      
      const center = await Center.getById(assignment.centerId);
      const assignmentPersonnel = await Personnel.getById(assignment.personnelId);
      
      const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const personnelName = (assignmentPersonnel?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');

      let successMessage = `✅ ماموریت #${assignmentId} تایید شد!\n\n` +
        `👤 پرسنل: ${personnelName}\n` +
        `🏢 مرکز: ${centerName}\n` +
        `💰 هزینه کل: ${(updatedAssignment.totalCost || 0).toLocaleString('fa-IR')} تومان`;
      
      if (managerComment) {
        successMessage += `\n\n📝 یادداشت شما برای کارشناس ارسال شد.`;
      }

      await this.bot.sendMessage(chatId, successMessage);

      // اطلاع‌رسانی به پرسنل
      await this.notifyAssignmentApproval(updatedAssignment);
    } catch (error) {
      console.error('Error in handleApprove:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // Helper: handle reject assignment
  async handleReject(chatId, assignmentId, telegramId, managerComment = null) {
    try {
      console.log(`[handleReject] Starting reject for assignment #${assignmentId} by telegramId: ${telegramId}`);
      
      const personnel = await Personnel.getByTelegramId(telegramId);
      if (!personnel) {
        console.error(`[handleReject] Personnel not found for telegramId: ${telegramId}`);
        await this.bot.sendMessage(chatId, '❌ شما در سیستم ثبت نشده‌اید.');
        return;
      }

      const isManager = personnel.role === 'admin' || personnel.role === 'manager';
      if (!isManager) {
        console.error(`[handleReject] User ${personnel.name} is not a manager`);
        await this.bot.sendMessage(chatId, '❌ فقط مدیران می‌توانند ماموریت‌ها را رد کنند.');
        return;
      }

      console.log(`[handleReject] Getting assignment #${assignmentId}`);
      const assignment = await AssignmentModel.getById(assignmentId);
      if (!assignment) {
        console.error(`[handleReject] Assignment #${assignmentId} not found`);
        await this.bot.sendMessage(chatId, `❌ ماموریت یافت نشد. (ID: ${assignmentId})`);
        return;
      }

      console.log(`[handleReject] Assignment found - ID: ${assignment.id}, Status: ${assignment.status}`);

      if (assignment.status !== 'pending') {
        await this.bot.sendMessage(chatId, `❌ این ماموریت در وضعیت "${this.getStatusLabel(assignment.status)}" است و نمی‌توان آن را رد کرد.`);
        return;
      }

      // رد ماموریت
      console.log(`[handleReject] Rejecting assignment #${assignmentId} by manager ${personnel.name} (ID: ${personnel.id})`);
      
      const updatedAssignment = await AssignmentModel.reject(assignmentId, parseInt(personnel.id), managerComment);

      if (!updatedAssignment) {
        console.error(`[handleReject] Failed to reject assignment #${assignmentId}`);
        await this.bot.sendMessage(chatId, '❌ خطا در رد ماموریت. لطفاً دوباره تلاش کنید.');
        return;
      }

      console.log(`[handleReject] Assignment #${assignmentId} rejected successfully. New status: ${updatedAssignment.status}`);
      
      const center = await Center.getById(assignment.centerId);
      const assignmentPersonnel = await Personnel.getById(assignment.personnelId);
      
      const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
      const personnelName = (assignmentPersonnel?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');

      let successMessage = `❌ ماموریت #${assignmentId} رد شد!\n\n` +
        `👤 پرسنل: ${personnelName}\n` +
        `🏢 مرکز: ${centerName}`;
      
      if (managerComment) {
        successMessage += `\n\n📝 یادداشت: ${managerComment}`;
      }

      await this.bot.sendMessage(chatId, successMessage);

      // اطلاع‌رسانی به پرسنل
      if (assignmentPersonnel?.telegramId) {
        try {
          let notificationMessage = `❌ ماموریت شما رد شد\n\n` +
            `📋 کد ماموریت: #${assignmentId}\n` +
            `🏢 مرکز: ${centerName}\n` +
            `👤 مدیر: ${personnel.name}`;
          
          if (managerComment) {
            notificationMessage += `\n\n📝 یادداشت مدیر:\n${managerComment}`;
          }
          
          await this.bot.sendMessage(assignmentPersonnel.telegramId, notificationMessage);
        } catch (error) {
          console.error(`[handleReject] Error notifying personnel:`, error.message);
        }
      }
    } catch (error) {
      console.error('[handleReject] Error in handleReject:', error);
      await this.bot.sendMessage(chatId, `❌ خطا: ${error.message}`);
    }
  }

  // Helper: notify assignment approval to personnel
  async notifyAssignmentApproval(assignment) {
    try {
      console.log(`[notifyAssignmentApproval] Starting notification for assignment #${assignment.id}`);
      const personnel = await Personnel.getById(assignment.personnelId);
      const center = await Center.getById(assignment.centerId);
      const manager = assignment.managerId ? await Personnel.getById(assignment.managerId) : null;
      
      if (!personnel) {
        console.error(`[notifyAssignmentApproval] Personnel not found for assignment #${assignment.id}`);
        return;
      }
      
      console.log(`[notifyAssignmentApproval] Personnel found: ${personnel.name} (ID: ${personnel.id}), telegramId: ${personnel.telegramId || 'N/A'}`);
      
      if (personnel.telegramId) {
        const centerName = (center?.name || 'نامشخص').replace(/[*_`\[\]()]/g, '');
        const managerName = (manager?.name || 'مدیر').replace(/[*_`\[\]()]/g, '');
        
        let message = `✅ ماموریت شما تایید شد!\n\n`;
        message += `📋 کد ماموریت: #${assignment.id}\n`;
        message += `🏢 مرکز: ${centerName}\n`;
        message += `👤 تایید کننده: ${managerName}\n`;
        message += `💰 هزینه کل: ${(assignment.totalCost || 0).toLocaleString('fa-IR')} تومان\n`;
        if (assignment.personalPayment > 0) {
          message += `💵 پرداخت شخصی: ${assignment.personalPayment.toLocaleString('fa-IR')} تومان\n`;
        }
        if (assignment.managerComment) {
          message += `\n💬 یادداشت مدیر:\n${assignment.managerComment.replace(/[*_`\[\]()]/g, '')}\n`;
        }
        message += `\n📊 وضعیت: ${this.getStatusLabel(assignment.status)}\n\n`;
        message += `💡 حالا می‌توانید ماموریت را انجام دهید.`;

        console.log(`[notifyAssignmentApproval] Attempting to send message to telegramId: ${personnel.telegramId}`);
        try {
          await this.bot.sendMessage(personnel.telegramId, message);
          console.log(`✅ Approval notification sent successfully to personnel ${personnel.name} (telegramId: ${personnel.telegramId}) for assignment #${assignment.id}`);
        } catch (sendError) {
          console.error(`❌ Error sending Telegram message to ${personnel.telegramId}:`, sendError);
          console.error(`[notifyAssignmentApproval] Error details:`, {
            message: sendError.message,
            code: sendError.code,
            response: sendError.response?.body
          });
          throw sendError; // Re-throw to be caught by outer catch
        }
      } else {
        console.warn(`⚠️ Personnel ${personnel.name} (ID: ${personnel.id}) has no telegramId. Cannot send approval notification.`);
      }
    } catch (error) {
      console.error('[notifyAssignmentApproval] Error in notifyAssignmentApproval:', error);
      console.error('[notifyAssignmentApproval] Error stack:', error.stack);
    }
  }

  async processUpdate(update) {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }
    try {
      await this.bot.processUpdate(update);
    } catch (error) {
      console.error('[TelegramBotService] processUpdate error:', error);
      throw error;
    }
  }
}

// Singleton pattern
  let telegramBotInstance = null;

  if (!telegramBotInstance) {
    telegramBotInstance = new TelegramBotService();
  }

  export default telegramBotInstance;