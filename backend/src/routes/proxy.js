/**
 * API Proxy Routes
 * Forwards requests to other backend services with authentication and permission checks
 */

import express from 'express';
import { authenticateToken } from '../routes/auth.js';
import { getPermissionForEndpoint, hasPermission } from '../middleware/permissions.js';
import axios from 'axios';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();

// Backend service URLs
const BACKEND_URLS = {
  'sales-analysis': process.env.SALES_ANALYSIS_API || 'http://localhost:3001/api',
  'ez-dashboard': process.env.EZ_DASHBOARD_API || 'http://localhost:9001/api',
  'leave-app2': process.env.LEAVE_APP2_API || 'http://localhost:8002/api',
  'leave-app3': process.env.LEAVE_APP3_API || 'http://localhost:8003/api',
  'recruitment': process.env.RECRUITMENT_API || 'http://localhost:3002/api',
};

// Frontend service URLs (for embedding)
const FRONTEND_URLS = {
  'sales-analysis': process.env.SALES_ANALYSIS_FRONTEND || 'http://localhost:5000',
  'ez-dashboard': process.env.EZ_DASHBOARD_FRONTEND || 'http://localhost:5173',
  'recruitment': process.env.RECRUITMENT_FRONTEND || 'http://localhost:3003',
};

/**
 * Proxy middleware - forwards requests to target backend
 */
async function proxyRequest(req, res, targetService, targetPath) {
  try {
    const targetUrl = BACKEND_URLS[targetService];
    if (!targetUrl) {
      return res.status(404).json({ message: `Service ${targetService} not found` });
    }

    // Get permission for this endpoint
    const permission = getPermissionForEndpoint(req.method, targetPath);
    if (permission && !hasPermission(req.user?.role, permission)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permission,
        role: req.user?.role
      });
    }

    // Build target URL
    const fullUrl = `${targetUrl}${targetPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    
    // Prepare headers
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };

    // Forward authentication token if available
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    } else if (req.user) {
      // If we have user from our auth, we can't forward token to external services
      // They need to verify via SSO endpoint
      // For now, we'll forward the request without auth header
      // The external service should verify via SSO if needed
    }

    // Forward query parameters
    const queryParams = new URLSearchParams(req.query).toString();
    const finalUrl = queryParams ? `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryParams}` : fullUrl;

    console.log(`[Proxy] ${req.method} ${targetService}${targetPath} -> ${finalUrl}`);

    // Make request to target backend
    const response = await axios({
      method: req.method,
      url: finalUrl,
      headers,
      data: req.body,
      timeout: 30000, // 30 seconds timeout
      validateStatus: () => true, // Don't throw on any status
    });

    // Forward response
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`[Proxy] Error proxying to ${targetService}:`, error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        message: `Service ${targetService} is unavailable`,
        error: 'Connection refused'
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({ 
        message: `Service ${targetService} timeout`,
        error: 'Request timeout'
      });
    }
    
    res.status(500).json({ 
      message: 'Proxy error',
      error: error.message
    });
  }
}

// Sales Analysis Dashboard Proxy
router.all('/sales-analysis/*', authenticateToken, async (req, res) => {
  const targetPath = req.path.replace('/sales-analysis', '');
  await proxyRequest(req, res, 'sales-analysis', targetPath);
});

// EZ Dashboard Proxy
router.all('/ez-dashboard/*', authenticateToken, async (req, res) => {
  const targetPath = req.path.replace('/ez-dashboard', '');
  await proxyRequest(req, res, 'ez-dashboard', targetPath);
});

// Leave App Backend 2 (Leave & Attendance) Proxy
router.all('/leave-management/*', authenticateToken, async (req, res) => {
  const targetPath = req.path.replace('/leave-management', '');
  
  // Route to appropriate backend based on path
  if (targetPath.startsWith('/medical') || targetPath.startsWith('/medical-files')) {
    await proxyRequest(req, res, 'leave-app3', targetPath.replace('/medical', '/medical-files'));
  } else {
    // Leave requests, attendances, salaries go to app2
    await proxyRequest(req, res, 'leave-app2', targetPath);
  }
});

// Leave App Backend 3 (Medical Files) Proxy
router.all('/medical-files/*', authenticateToken, async (req, res) => {
  const targetPath = req.path.replace('/medical-files', '');
  await proxyRequest(req, res, 'leave-app3', `/medical-files${targetPath}`);
});

// Recruitment Dashboard Proxy
router.all('/recruitment/*', authenticateToken, async (req, res) => {
  const targetPath = req.path.replace('/recruitment', '');
  await proxyRequest(req, res, 'recruitment', targetPath);
});

/**
 * Frontend Proxy Middleware - Creates proxy middleware for frontend services
 */
function createFrontendProxy(frontendService) {
  const frontendUrl = FRONTEND_URLS[frontendService];
  if (!frontendUrl) {
    throw new Error(`Frontend service ${frontendService} not found`);
  }

  return createProxyMiddleware({
    target: frontendUrl,
    changeOrigin: true,
    ws: true, // Enable websocket proxying
    logLevel: 'info',
    pathRewrite: (path, req) => {
      // Remove the proxy prefix from the path
      const prefix = `/api/proxy/frontend/${frontendService}`;
      if (path.startsWith(prefix)) {
        const newPath = path.replace(prefix, '') || '/';
        console.log(`[Frontend Proxy] Path rewrite: ${path} -> ${newPath}`);
        return newPath;
      }
      return path;
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add token to query string for SSO
      const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
      if (token && !proxyReq.path.includes('token=')) {
        const separator = proxyReq.path.includes('?') ? '&' : '?';
        proxyReq.path = `${proxyReq.path}${separator}token=${token}`;
      }
      
      // Forward original headers
      proxyReq.setHeader('X-Forwarded-For', req.ip || req.socket.remoteAddress);
      proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
      proxyReq.setHeader('X-Forwarded-Host', req.get('host'));
      
      console.log(`[Frontend Proxy] ${req.method} ${req.path} -> ${frontendUrl}${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Modify response headers for CORS and embedding
      // Allow embedding in iframe
      proxyRes.headers['X-Frame-Options'] = 'SAMEORIGIN';
      delete proxyRes.headers['x-frame-options']; // Remove lowercase version
      
      // Remove CSP headers that might block embedding
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['Content-Security-Policy'];
      
      // Remove any other headers that might block embedding
      delete proxyRes.headers['frame-ancestors'];
      delete proxyRes.headers['Frame-Ancestors'];
      
      // Set CORS headers to allow embedding
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      
      console.log(`[Frontend Proxy] Response status: ${proxyRes.statusCode}, Content-Type: ${proxyRes.headers['content-type']}`);
    },
    onError: (err, req, res) => {
      console.error(`[Frontend Proxy] Error proxying ${frontendService}:`, err.message);
      if (!res.headersSent) {
        res.status(503).send(`
          <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial; padding: 20px; direction: rtl;">
              <h1>سرویس در دسترس نیست</h1>
              <p>سرویس ${frontendService} در حال اجرا نیست.</p>
              <p>لطفاً اطمینان حاصل کنید که سرویس روی ${frontendUrl} در حال اجرا است.</p>
            </body>
          </html>
        `);
      }
    },
  });
}

// Sales Analysis Dashboard Frontend Proxy (for embedding)
// Use wildcard to catch all paths including root and sub-paths
router.use('/frontend/sales-analysis*', authenticateToken, createFrontendProxy('sales-analysis'));

// EZ Dashboard Frontend Proxy (for embedding)
router.use('/frontend/ez-dashboard*', authenticateToken, createFrontendProxy('ez-dashboard'));

// Recruitment Frontend Proxy (for embedding)
router.use('/frontend/recruitment*', authenticateToken, createFrontendProxy('recruitment'));

export default router;

