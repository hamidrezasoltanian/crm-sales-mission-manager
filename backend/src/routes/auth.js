import express from 'express';
import jwt from 'jsonwebtoken';
import { AuthController } from '../controllers/authController.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET environment variable is required. Please set it in .env file');
}

// Middleware for protected routes
export const authenticateToken = (req, res, next) => {
  // Try to get token from Authorization header first
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // If no token in header, try query string (for iframe embedding)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'توکن احراز هویت یافت نشد' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error('[authenticateToken] JWT verification failed:', err.message);
      return res.status(403).json({ message: 'توکن نامعتبر است' });
    }
    
    console.log('[authenticateToken] Token verified, decoded ID:', decoded.id);
    
    // Get full user data from database
    try {
      const { Personnel } = await import('../models/Personnel.js');
      console.log('[authenticateToken] Getting user by ID:', decoded.id);
      const user = await Personnel.getById(decoded.id);
      if (!user) {
        console.error('[authenticateToken] User not found:', decoded.id);
        return res.status(403).json({ message: 'کاربر یافت نشد' });
      }
      console.log('[authenticateToken] User found:', user.id, user.username);
      if (!user.isActive) {
        console.error('[authenticateToken] User is inactive:', decoded.id);
        return res.status(403).json({ message: 'کاربر غیرفعال است' });
      }
      // Construct name from first_name and last_name (name is a generated column)
      const firstName = user.first_name || '';
      const lastName = user.last_name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
      
      req.user = {
        id: user.id,
        role: user.role || 'staff',
        username: user.username || null,
        name: fullName
      };
      console.log('[authenticateToken] User authenticated:', req.user.id, req.user.username);
      next();
    } catch (error) {
      console.error('[authenticateToken] Error loading user:', error);
      console.error('[authenticateToken] Error stack:', error.stack);
      return res.status(500).json({ message: 'خطا در بارگذاری اطلاعات کاربر: ' + error.message });
    }
  });
};

// Routes
router.post('/login', AuthController.login);
router.post('/login-2fa', AuthController.loginWith2FA);
router.post('/register', AuthController.register);
router.post('/telegram', AuthController.telegramLogin);
router.post('/email-otp/send', AuthController.sendEmailOTP);
router.post('/email-otp/verify', AuthController.verifyEmailOTP);
router.post('/magic-link/send', AuthController.sendMagicLink);
router.post('/magic-link/verify', AuthController.verifyMagicLink);
router.get('/me', authenticateToken, AuthController.getMe);
router.get('/verify', AuthController.verifyToken); // Public endpoint for SSO
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.put('/password', authenticateToken, AuthController.changePassword);
// 2FA Routes
router.get('/2fa/check', authenticateToken, AuthController.check2FA);
router.post('/2fa/enable', authenticateToken, AuthController.enable2FA);
router.post('/2fa/disable', authenticateToken, AuthController.disable2FA);
router.post('/2fa/verify', AuthController.verify2FA);
router.post('/2fa/backup-codes/regenerate', authenticateToken, AuthController.regenerateBackupCodes);

export default router;
// authenticateToken is already exported inline on line 12

