import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET environment variable is required');
}

/**
 * SSO Middleware - Verifies token from main system
 * This allows other systems to use the same authentication
 */
export const verifySSOToken = async (req, res, next) => {
  try {
    // Get token from header or query
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
      return res.status(401).json({ 
        valid: false, 
        message: 'Token not provided',
        redirect: '/login'
      });
    }

    try {
      // Verify token using shared secret
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Attach user info to request
      req.ssoUser = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          valid: false, 
          message: 'Token expired',
          redirect: '/login'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          valid: false, 
          message: 'Invalid token',
          redirect: '/login'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('SSO verification error:', error);
    res.status(500).json({ 
      valid: false, 
      message: 'SSO verification failed' 
    });
  }
};

/**
 * Optional SSO - Allows access if token is valid, but doesn't require it
 */
export const optionalSSO = async (req, res, next) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.ssoUser = {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role
        };
      } catch (error) {
        // Token invalid, but continue without user
        req.ssoUser = null;
      }
    }
    
    next();
  } catch (error) {
    // Continue without SSO
    req.ssoUser = null;
    next();
  }
};

