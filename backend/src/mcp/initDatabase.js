/**
 * Initialize database connection for MCP server
 * این فایل برای اطمینان از اتصال دیتابیس قبل از استفاده در MCP server است
 */

import { connectDB, getDB } from '../config/database.js';

let dbInitialized = false;
let initPromise = null;

export async function ensureDatabaseConnection() {
  if (dbInitialized) {
    try {
      getDB(); // بررسی اینکه دیتابیس هنوز متصل است
      return;
    } catch (error) {
      // اگر دیتابیس قطع شده، دوباره اتصال برقرار کن
      dbInitialized = false;
      initPromise = null;
    }
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      await connectDB();
      dbInitialized = true;
      console.error('[MCP] Database connection initialized');
    } catch (error) {
      console.error('[MCP] Failed to initialize database:', error);
      dbInitialized = false;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

