import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Personnel } from '../models/Personnel.js';
import { getDB } from '../config/database.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET environment variable is required. Please set it in .env file');
}
const JWT_EXPIRES_IN = '24h';

export class AuthController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'نام کاربری و رمز عبور الزامی است' });
      }

      // Find user by username
      const user = await Personnel.getByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
      }

      // Verify password
      const isValid = await Personnel.verifyPassword(user.password, password);
      if (!isValid) {
        return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'حساب کاربری شما غیرفعال شده است' });
      }

      // Check if 2FA is enabled
      const { TwoFactorAuth } = await import('../models/TwoFactorAuth.js');
      const twoFA = await TwoFactorAuth.getByUserId(user.id);

      if (twoFA && twoFA.enabled) {
        // 2FA is enabled, require code
        // Send OTP if email method
        if (twoFA.method === 'email' && user.email) {
          const { OTP } = await import('../models/OTP.js');
          const otpData = await OTP.create({
            email: user.email,
            userId: user.id,
            purpose: '2fa',
            expiresInMinutes: 5
          });

          const emailService = (await import('../services/emailService.js')).default;
          await emailService.sendOTP(user.email, otpData.code, user.name);

          return res.status(200).json({
            requires2FA: true,
            message: 'کد تأیید به ایمیل شما ارسال شد',
            method: 'email',
            userId: user.id
          });
        }

        return res.status(200).json({
          requires2FA: true,
          message: 'کد تأیید دو مرحله‌ای الزامی است',
          method: twoFA.method,
          userId: user.id
        });
      }

      // Generate Token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Send response (exclude password hash)
      const userResponse = Personnel.formatRow(user);

      // Log activity
      await AuthController.logActivity(user.id, 'login', {
        method: 'username_password',
        with2FA: false
      }, req);

      res.json({
        message: 'ورود موفقیت‌آمیز بود',
        token,
        user: userResponse
      });

    } catch (error) {
      console.error('Login error FULL DETAILS:', error);
      if (error.code === 'SQLITE_ERROR') {
         console.error('Database Schema Error. Did you run the migration script?');
      }
      res.status(500).json({ message: 'خطای سرور: ' + error.message });
    }
  }

  static async getMe(req, res) {
    try {
      console.log('[GetMe] Request from user ID:', req.user.id);
      const user = await Personnel.getById(req.user.id);
      if (!user) {
        console.error('[GetMe] User not found:', req.user.id);
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }
      console.log('[GetMe] User found:', user.id, user.username);
      res.json(user);
    } catch (error) {
      console.error('[GetMe] Error:', error);
      console.error('[GetMe] Error stack:', error.stack);
      res.status(500).json({ message: 'خطای سرور: ' + error.message });
    }
  }

  static async verifyToken(req, res) {
    try {
      // This endpoint is for SSO - allows other systems to verify tokens
      const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
      
      if (!token) {
        return res.status(401).json({ valid: false, message: 'Token not provided' });
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await Personnel.getById(decoded.id);
        
        if (!user) {
          return res.status(404).json({ valid: false, message: 'User not found' });
        }

        if (!user.isActive) {
          return res.status(403).json({ valid: false, message: 'User is inactive' });
        }

        res.json({
          valid: true,
          user: Personnel.formatRow(user),
          expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
        });
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ valid: false, message: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ valid: false, message: 'Invalid token' });
        }
        throw error;
      }
    } catch (error) {
      console.error('VerifyToken error:', error);
      res.status(500).json({ valid: false, message: 'Server error' });
    }
  }

  static async register(req, res) {
    try {
      const { name, phone, telegramId, username, password, role = 'staff' } = req.body;

      // Validation - فقط نام و شماره تماس الزامی است
      if (!name || !phone) {
        return res.status(400).json({ 
          message: 'نام و شماره تماس الزامی هستند' 
        });
      }

      // Use default password if not provided
      const DEFAULT_PASSWORD = '123456';
      const finalPassword = password || DEFAULT_PASSWORD;

      // Generate username from phone if not provided
      const finalUsername = username || `user_${phone.replace(/\D/g, '')}`;

      // Check if username exists - فقط اگر username داده شده باشد
      if (username) {
        const existing = await Personnel.getByUsername(username);
        if (existing) {
          return res.status(409).json({ 
            message: 'نام کاربری قبلاً استفاده شده است' 
          });
        }
      }

      // Check if phone exists - فقط هشدار بده، مانع نشو
      const existingPhone = await Personnel.getByPhone(phone);
      if (existingPhone) {
        // اگر کاربر موجود است، فقط هشدار بده
        return res.status(409).json({ 
          message: 'شماره تماس قبلاً ثبت شده است. لطفاً با مدیر تماس بگیرید.' 
        });
      }

      // Create user with default password
      const user = await Personnel.create({
        name,
        phone,
        telegramId: telegramId || null,
        username: finalUsername,
        password: finalPassword,
        role,
        isActive: true // فعال به صورت پیش‌فرض
      });

      res.status(201).json({
        message: `حساب کاربری ایجاد شد. نام کاربری: ${user.username}, رمز عبور پیش‌فرض: ${DEFAULT_PASSWORD}. لطفاً پس از ورود آن را تغییر دهید.`,
        user: Personnel.formatRow(user),
        username: user.username,
        defaultPassword: DEFAULT_PASSWORD
      });
    } catch (error) {
      console.error('Registration error:', error);
      // اگر خطای UNIQUE constraint است، پیام مناسب بده
      if (error.message.includes('UNIQUE constraint') || error.message.includes('تکراری')) {
        return res.status(409).json({ 
          message: 'این اطلاعات قبلاً ثبت شده است. لطفاً با مدیر تماس بگیرید.' 
        });
      }
      res.status(400).json({ message: error.message || 'خطا در ثبت‌نام' });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await Personnel.getById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }
      res.json(user);
    } catch (error) {
      console.error('GetProfile error:', error);
      res.status(500).json({ message: 'خطا در دریافت پروفایل' });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { name, phone, telegramId } = req.body;
      
      // Validate phone if provided
      if (phone) {
        const phoneRegex = /^09\d{9}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
          return res.status(400).json({ 
            message: 'شماره تماس باید با 09 شروع شود و 11 رقم باشد' 
          });
        }
      }

      const updated = await Personnel.update(req.user.id, {
        name,
        phone,
        telegramId
      });

      if (!updated) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      res.json(updated);
    } catch (error) {
      console.error('UpdateProfile error:', error);
      res.status(400).json({ message: error.message || 'خطا در به‌روزرسانی پروفایل' });
    }
  }

  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          message: 'رمز عبور فعلی و جدید الزامی هستند' 
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ 
          message: 'رمز عبور جدید باید حداقل 6 کاراکتر باشد' 
        });
      }

      const user = await Personnel.getByUsername(req.user.username);
      if (!user) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      // Verify current password
      const isValid = await Personnel.verifyPassword(user.password, currentPassword);
      if (!isValid) {
        return res.status(401).json({ message: 'رمز عبور فعلی اشتباه است' });
      }

      // Update password
      await Personnel.update(req.user.id, { password: newPassword });

      res.json({ message: 'رمز عبور با موفقیت تغییر کرد' });
    } catch (error) {
      console.error('ChangePassword error:', error);
      res.status(400).json({ message: error.message || 'خطا در تغییر رمز عبور' });
    }
  }

  static async telegramLogin(req, res) {
    try {
      const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;

      // Validate required fields
      if (!id || !first_name || !auth_date || !hash) {
        return res.status(400).json({ 
          message: 'داده‌های Telegram ناقص است' 
        });
      }

      // Verify Telegram data hash (security check)
      // Note: In production, you should verify the hash using Telegram's algorithm
      // For now, we'll trust the data but check if user exists
      
      const telegramId = id.toString();
      let user = await Personnel.getByTelegramId(telegramId);

      // If user doesn't exist, create one (or return error based on your policy)
      if (!user) {
        // Option 1: Auto-create user (if you want)
        // Option 2: Return error and ask user to register first
        return res.status(404).json({ 
          message: 'حساب کاربری با این Telegram ID یافت نشد. لطفاً ابتدا ثبت‌نام کنید.',
          telegramId: telegramId
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ 
          message: 'حساب کاربری شما غیرفعال است. لطفاً با مدیر تماس بگیرید.' 
        });
      }

      // Update user's Telegram info if changed
      const fullName = `${first_name}${last_name ? ' ' + last_name : ''}`;
      if (user.name !== fullName || user.telegramId !== telegramId) {
        await Personnel.update(user.id, {
          name: fullName,
          telegramId: telegramId
        });
        user = await Personnel.getById(user.id);
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Log activity
      await AuthController.logActivity(user.id, 'telegram_login', {
        telegramId,
        authDate: auth_date
      }, req);

      res.json({
        message: 'ورود با Telegram موفقیت‌آمیز بود',
        token,
        user: Personnel.formatRow(user)
      });
    } catch (error) {
      console.error('Telegram login error:', error);
      res.status(500).json({ message: 'خطا در ورود با Telegram: ' + error.message });
    }
  }

  static async logActivity(userId, action, details = null, req = null) {
    try {
      const { ActivityLog } = await import('../models/ActivityLog.js');
      await ActivityLog.create({
        userId,
        action,
        details,
        ipAddress: req?.ip || req?.connection?.remoteAddress || null,
        userAgent: req?.get?.('user-agent') || req?.headers?.['user-agent'] || null
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - logging is not critical
    }
  }

  static async sendEmailOTP(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'ایمیل الزامی است' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'فرمت ایمیل نامعتبر است' });
      }

      // Find user by email
      const { Personnel } = await import('../models/Personnel.js');
      const user = await Personnel.getByEmail(email);
      
      // If user not found, return error (or you can allow registration)
      if (!user) {
        return res.status(404).json({ 
          message: 'حساب کاربری با این ایمیل یافت نشد. لطفاً ابتدا ثبت‌نام کنید.',
          email: email
        });
      }
      
      // Check rate limiting (max 5 OTPs per hour per email)
      const { OTP } = await import('../models/OTP.js');
      const stats = await OTP.getStats(email);
      if (stats && stats.total >= 5) {
        return res.status(429).json({ 
          message: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً بعداً تلاش کنید.' 
        });
      }

      // Create OTP
      const otpData = await OTP.create({
        email,
        purpose: 'login',
        expiresInMinutes: 5
      });

      // Send email
      const emailService = (await import('../services/emailService.js')).default;
      await emailService.sendOTP(email, otpData.code, user?.name);

      // Log activity if user found
      if (user) {
        await AuthController.logActivity(user.id, 'email_otp_sent', { email }, req);
      }

      res.json({
        message: 'کد تأیید به ایمیل شما ارسال شد',
        expiresIn: 5 // minutes
      });

    } catch (error) {
      console.error('Send email OTP error:', error);
      res.status(500).json({ message: 'خطا در ارسال کد تأیید: ' + error.message });
    }
  }

  static async verifyEmailOTP(req, res) {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: 'ایمیل و کد الزامی هستند' });
      }

      // Verify OTP
      const { OTP } = await import('../models/OTP.js');
      const verification = await OTP.verify(email, code, 'login');

      if (!verification.valid) {
        return res.status(400).json({ message: verification.error });
      }

      // Find user by email
      const { Personnel } = await import('../models/Personnel.js');
      const user = await Personnel.getByEmail(email);
      
      if (!user) {
        return res.status(404).json({ 
          message: 'حساب کاربری با این ایمیل یافت نشد. لطفاً ابتدا ثبت‌نام کنید.',
          email: email
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ 
          message: 'حساب کاربری شما غیرفعال است. لطفاً با مدیر تماس بگیرید.' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Log activity
      await AuthController.logActivity(user.id, 'email_otp_login', { email }, req);

      res.json({
        message: 'ورود با کد تأیید موفقیت‌آمیز بود',
        token,
        user: Personnel.formatRow(user)
      });

    } catch (error) {
      console.error('Verify email OTP error:', error);
      res.status(500).json({ message: 'خطا در تأیید کد: ' + error.message });
    }
  }

  static async sendMagicLink(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'ایمیل الزامی است' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'فرمت ایمیل نامعتبر است' });
      }

      // Find user by email
      const { Personnel } = await import('../models/Personnel.js');
      const user = await Personnel.getByEmail(email);
      
      if (!user) {
        return res.status(404).json({ 
          message: 'حساب کاربری با این ایمیل یافت نشد. لطفاً ابتدا ثبت‌نام کنید.',
          email: email
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ 
          message: 'حساب کاربری شما غیرفعال است. لطفاً با مدیر تماس بگیرید.' 
        });
      }

      // Check rate limiting
      const { OTP } = await import('../models/OTP.js');
      const stats = await OTP.getStats(email);
      if (stats && stats.total >= 5) {
        return res.status(429).json({ 
          message: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً بعداً تلاش کنید.' 
        });
      }

      // Create magic link token
      const otpData = await OTP.create({
        email,
        userId: user.id,
        purpose: 'magic_link',
        expiresInMinutes: 15
      });

      // Build magic link URL
      const baseUrl = process.env.FRONTEND_URL || process.env.WORKFLOW_CARD_BASE_URL || 'http://localhost:3000';
      const magicLink = `${baseUrl}/auth/magic-link?token=${otpData.token}`;

      // Send email
      const emailService = (await import('../services/emailService.js')).default;
      await emailService.sendMagicLink(email, magicLink, user.name);

      // Log activity
      await AuthController.logActivity(user.id, 'magic_link_sent', { email }, req);

      res.json({
        message: 'لینک ورود به ایمیل شما ارسال شد',
        expiresIn: 15 // minutes
      });

    } catch (error) {
      console.error('Send magic link error:', error);
      res.status(500).json({ message: 'خطا در ارسال لینک: ' + error.message });
    }
  }

  static async verifyMagicLink(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Token الزامی است' });
      }

      // Verify magic link
      const { OTP } = await import('../models/OTP.js');
      const verification = await OTP.verifyMagicLink(token);

      if (!verification.valid) {
        return res.status(400).json({ message: verification.error });
      }

      // Find user
      const { Personnel } = await import('../models/Personnel.js');
      const user = await Personnel.getById(verification.userId);
      
      if (!user) {
        return res.status(404).json({ message: 'کاربر یافت نشد' });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ 
          message: 'حساب کاربری شما غیرفعال است. لطفاً با مدیر تماس بگیرید.' 
        });
      }

      // Generate JWT token
      const token_jwt = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Log activity
      await AuthController.logActivity(user.id, 'magic_link_login', { email: verification.email }, req);

      res.json({
        message: 'ورود با لینک موفقیت‌آمیز بود',
        token: token_jwt,
        user: Personnel.formatRow(user)
      });

    } catch (error) {
      console.error('Verify magic link error:', error);
      res.status(500).json({ message: 'خطا در تأیید لینک: ' + error.message });
    }
  }

  static async check2FA(req, res) {
    try {
      // Use authenticated user ID from token (req.user is set by authenticateToken middleware)
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(400).json({ message: 'userId الزامی است. لطفاً دوباره وارد شوید.' });
      }

      const { TwoFactorAuth } = await import('../models/TwoFactorAuth.js');
      const twoFA = await TwoFactorAuth.getByUserId(parseInt(userId));

      res.json({
        enabled: twoFA?.enabled || false,
        method: twoFA?.method || 'email'
      });

    } catch (error) {
      console.error('Check 2FA error:', error);
      res.status(500).json({ message: 'خطا در بررسی 2FA: ' + error.message });
    }
  }

  static async enable2FA(req, res) {
    try {
      const userId = req.user.id;
      const { method = 'email' } = req.body;

      const { TwoFactorAuth } = await import('../models/TwoFactorAuth.js');
      const result = await TwoFactorAuth.enable(userId, method);

      // Log activity
      await AuthController.logActivity(userId, '2fa_enabled', { method }, req);

      res.json({
        message: 'احراز هویت دو مرحله‌ای فعال شد',
        ...result
      });

    } catch (error) {
      console.error('Enable 2FA error:', error);
      res.status(500).json({ message: 'خطا در فعال‌سازی 2FA: ' + error.message });
    }
  }

  static async disable2FA(req, res) {
    try {
      const userId = req.user.id;

      const { TwoFactorAuth } = await import('../models/TwoFactorAuth.js');
      await TwoFactorAuth.disable(userId);

      // Log activity
      await AuthController.logActivity(userId, '2fa_disabled', {}, req);

      res.json({
        message: 'احراز هویت دو مرحله‌ای غیرفعال شد'
      });

    } catch (error) {
      console.error('Disable 2FA error:', error);
      res.status(500).json({ message: 'خطا در غیرفعال‌سازی 2FA: ' + error.message });
    }
  }

  static async verify2FA(req, res) {
    try {
      const { userId, code, backupCode } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'userId الزامی است' });
      }

      const { TwoFactorAuth } = await import('../models/TwoFactorAuth.js');
      const twoFA = await TwoFactorAuth.getByUserId(userId);

      if (!twoFA || !twoFA.enabled) {
        return res.status(400).json({ message: '2FA فعال نیست' });
      }

      // If backup code provided
      if (backupCode) {
        const verification = await TwoFactorAuth.verifyBackupCode(userId, backupCode);
        if (!verification.valid) {
          return res.status(400).json({ message: verification.error });
        }
        return res.json({ 
          valid: true, 
          message: 'کد پشتیبان معتبر است',
          remainingCodes: verification.remainingCodes
        });
      }

      // If OTP code provided (for email 2FA)
      if (code && twoFA.method === 'email') {
        const { Personnel } = await import('../models/Personnel.js');
        const user = await Personnel.getById(userId);
        
        if (!user || !user.email) {
          return res.status(400).json({ message: 'ایمیل کاربر یافت نشد' });
        }

        const { OTP } = await import('../models/OTP.js');
        const verification = await OTP.verify(user.email, code, '2fa');
        
        if (!verification.valid) {
          return res.status(400).json({ message: verification.error });
        }

        return res.json({ valid: true, message: 'کد تأیید معتبر است' });
      }

      return res.status(400).json({ message: 'کد یا کد پشتیبان الزامی است' });

    } catch (error) {
      console.error('Verify 2FA error:', error);
      res.status(500).json({ message: 'خطا در تأیید 2FA: ' + error.message });
    }
  }

  static async regenerateBackupCodes(req, res) {
    try {
      const userId = req.user.id;

      const { TwoFactorAuth } = await import('../models/TwoFactorAuth.js');
      const result = await TwoFactorAuth.regenerateBackupCodes(userId);

      // Log activity
      await AuthController.logActivity(userId, '2fa_backup_codes_regenerated', {}, req);

      res.json({
        message: 'کدهای پشتیبان جدید ایجاد شدند',
        backupCodes: result.backupCodes
      });

    } catch (error) {
      console.error('Regenerate backup codes error:', error);
      res.status(500).json({ message: 'خطا در ایجاد کدهای پشتیبان: ' + error.message });
    }
  }

  static async loginWith2FA(req, res) {
    try {
      const { username, password, code, backupCode } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'نام کاربری و رمز عبور الزامی است' });
      }

      // Find user by username
      const { Personnel } = await import('../models/Personnel.js');
      const user = await Personnel.getByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
      }

      // Verify password
      const isValid = await Personnel.verifyPassword(user.password, password);
      if (!isValid) {
        return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'حساب کاربری شما غیرفعال شده است' });
      }

      // Check if 2FA is enabled
      const { TwoFactorAuth } = await import('../models/TwoFactorAuth.js');
      const twoFA = await TwoFactorAuth.getByUserId(user.id);

      if (twoFA && twoFA.enabled) {
        // 2FA is enabled, require code
        if (!code && !backupCode) {
          // Send OTP if email method
          if (twoFA.method === 'email' && user.email) {
            const { OTP } = await import('../models/OTP.js');
            const otpData = await OTP.create({
              email: user.email,
              userId: user.id,
              purpose: '2fa',
              expiresInMinutes: 5
            });

            const emailService = (await import('../services/emailService.js')).default;
            await emailService.sendOTP(user.email, otpData.code, user.name);

            return res.status(200).json({
              requires2FA: true,
              message: 'کد تأیید به ایمیل شما ارسال شد',
              method: 'email'
            });
          }

          return res.status(200).json({
            requires2FA: true,
            message: 'کد تأیید دو مرحله‌ای الزامی است',
            method: twoFA.method
          });
        }

        // Verify 2FA code
        if (backupCode) {
          const verification = await TwoFactorAuth.verifyBackupCode(user.id, backupCode);
          if (!verification.valid) {
            return res.status(401).json({ message: verification.error });
          }
        } else if (code) {
          if (twoFA.method === 'email' && user.email) {
            const { OTP } = await import('../models/OTP.js');
            const verification = await OTP.verify(user.email, code, '2fa');
            if (!verification.valid) {
              return res.status(401).json({ message: verification.error });
            }
          }
        }
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Log activity
      await AuthController.logActivity(user.id, 'login', {
        method: 'username_password',
        with2FA: twoFA?.enabled || false
      }, req);

      res.json({
        message: 'ورود موفقیت‌آمیز بود',
        token,
        user: Personnel.formatRow(user)
      });

    } catch (error) {
      console.error('Login with 2FA error:', error);
      res.status(500).json({ message: 'خطای سرور: ' + error.message });
    }
  }
}


