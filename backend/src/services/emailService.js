import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    // Email configuration from environment variables
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    };

    // If SMTP credentials are not provided, use a test account (for development)
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      console.warn('⚠️ SMTP credentials not found. Email service will use test mode.');
      console.warn('⚠️ Set SMTP_USER and SMTP_PASSWORD in .env file for production.');
      
      // Create a test account (ethereal.email) for development
      // Note: This will fail in actual sending, but allows the service to initialize
      // For real test emails, use nodemailer.createTestAccount() or configure SMTP
      console.warn('⚠️ Using placeholder email config. Emails will not be sent.');
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'test@ethereal.email',
          pass: 'test'
        },
        // Don't fail on connection errors in test mode
        tls: {
          rejectUnauthorized: false
        }
      });
    } else {
      this.transporter = nodemailer.createTransport(emailConfig);
    }

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email service connection error:', error);
      } else {
        console.log('✅ Email service ready');
      }
    });
  }

  async sendOTP(email, code, userName = null) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
      to: email,
      subject: 'کد تأیید ورود به سیستم',
      html: `
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #2563eb; text-align: center; margin-bottom: 20px;">کد تأیید ورود</h2>
            ${userName ? `<p style="color: #333; font-size: 16px;">سلام ${userName}،</p>` : ''}
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              کد تأیید شما برای ورود به سیستم:
            </p>
            <div style="background-color: #f0f9ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 5px; margin: 0; font-family: 'Courier New', monospace;">
                ${code}
              </h1>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              این کد به مدت <strong>5 دقیقه</strong> معتبر است.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              اگر شما این درخواست را نداده‌اید، لطفاً این ایمیل را نادیده بگیرید.
            </p>
          </div>
        </div>
      `,
      text: `
کد تأیید ورود شما: ${code}

این کد به مدت 5 دقیقه معتبر است.

اگر شما این درخواست را نداده‌اید، لطفاً این ایمیل را نادیده بگیرید.
      `
    };

    try {
      // Check if transporter is properly initialized
      if (!this.transporter) {
        console.warn('⚠️ Email transporter not initialized. Using test mode.');
        console.warn('⚠️ OTP Code for', email, ':', code);
        return { success: true, messageId: 'test-mode', testMode: true, code: code };
      }

      // If SMTP is not configured, skip actual sending and return success
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('⚠️ SMTP not configured. Email not sent, but OTP was generated.');
        console.warn('⚠️ OTP Code for', email, ':', code);
        console.warn('⚠️ To enable email sending, configure SMTP_USER and SMTP_PASSWORD in .env');
        return { success: true, messageId: 'test-mode', testMode: true, code: code };
      }

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent:', info.messageId);
      
      // In development with ethereal.email, log the preview URL
      if (process.env.NODE_ENV === 'development' && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('📧 Preview URL:', previewUrl);
        }
      }
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      // If SMTP is not configured or error occurred, return success in development mode
      if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('⚠️ SMTP not configured. Email not sent, but OTP was generated.');
        console.warn('⚠️ OTP Code for', email, ':', code);
        return { success: true, messageId: 'test-mode', testMode: true, code: code };
      }
      // If SMTP is configured but failed, still log OTP for development
      console.warn('⚠️ Email sending failed, but OTP was generated.');
      console.warn('⚠️ OTP Code for', email, ':', code);
      throw new Error('خطا در ارسال ایمیل: ' + error.message);
    }
  }

  async sendMagicLink(email, link, userName = null) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
      to: email,
      subject: 'لینک ورود به سیستم',
      html: `
        <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #2563eb; text-align: center; margin-bottom: 20px;">لینک ورود</h2>
            ${userName ? `<p style="color: #333; font-size: 16px;">سلام ${userName}،</p>` : ''}
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              برای ورود به سیستم روی لینک زیر کلیک کنید:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
                ورود به سیستم
              </a>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              این لینک به مدت <strong>15 دقیقه</strong> معتبر است و فقط یکبار قابل استفاده است.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              اگر شما این درخواست را نداده‌اید، لطفاً این ایمیل را نادیده بگیرید.
            </p>
          </div>
        </div>
      `,
      text: `
برای ورود به سیستم روی لینک زیر کلیک کنید:
${link}

این لینک به مدت 15 دقیقه معتبر است.

اگر شما این درخواست را نداده‌اید، لطفاً این ایمیل را نادیده بگیرید.
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Magic link email sent:', info.messageId);
      
      if (process.env.NODE_ENV === 'development' && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log('📧 Preview URL:', previewUrl);
        }
      }
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending magic link email:', error);
      throw new Error('خطا در ارسال ایمیل: ' + error.message);
    }
  }
}

export default new EmailService();

