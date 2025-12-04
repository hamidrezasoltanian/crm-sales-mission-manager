import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// CRITICAL: باید dotenv.config() را قبل از import telegramBot صدا بزنیم
dotenv.config();

import { connectDB } from './config/database.js';
import personnelRoutes from './routes/personnel.js';
import centerRoutes from './routes/centers.js';
import assignmentRoutes from './routes/assignments.js';
import contactRoutes from './routes/contacts.js';
import reportRoutes from './routes/reports.js';
import discountCodeRoutes from './routes/discountCodes.js';
import customerSourceRoutes from './routes/customerSources.js';
import pdfRoutes from './routes/pdf.js';
import authRoutes from './routes/auth.js';
import workflowRoutes from './routes/workflow.js';
import activityRoutes from './routes/activity.js';
import proxyRoutes from './routes/proxy.js';
import permissionRoutes from './routes/permissions.js';
import workspaceRoutes from './routes/workspaces.js';
import notificationRoutes from './routes/notifications.js';
import reminderRoutes from './routes/reminders.js';
import telegramBot from './services/telegramBot.js';
import { ensureUploadDirectories } from './middleware/upload.js';

const app = express();
const PORT = process.env.PORT || 2001;
const uploadRoot = path.join(process.cwd(), 'uploads');

ensureUploadDirectories();

// Middleware - CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : (process.env.NODE_ENV === 'production' ? [] : true);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Note: CSP headers are set in Next.js frontend, not here
// Backend only handles API requests, not page rendering

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/uploads', express.static(uploadRoot));

// Connect to database and start server
connectDB().then(() => {
  console.log('✅ Database ready');
  
  // Start server after database is ready
  // Listen on all interfaces (0.0.0.0) to allow network access
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 Network access: http://0.0.0.0:${PORT}/api`);
  });
}).catch((error) => {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/discount-codes', discountCodeRoutes);
app.use('/api/customer-sources', customerSourceRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reminders', reminderRoutes);
// API Proxy for external backends
app.use('/api/proxy', proxyRoutes);

app.post('/api/telegram/handle', async (req, res) => {
  try {
    await telegramBot.processUpdate(req.body);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Error processing Telegram update:', error);
    res.status(500).json({ error: 'Failed to process Telegram update' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running v2 (Auth Added)' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: err.message || 'خطای سرور',
    ...(isDev && { stack: err.stack })
  });
});

// Server will be started after database connection (see above)
