#!/usr/bin/env node
/**
 * تست ساده برای MCP Server
 * این فایل برای تست مستقیم MCP server استفاده می‌شود
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'centerSuggestionsServer.js');

console.log('🧪 Testing MCP Center Suggestions Server...\n');
console.log('Server path:', serverPath);
console.log('\nبرای تست کامل، MCP server را در Cursor/Claude Desktop تنظیم کنید.\n');
console.log('مثال استفاده:\n');
console.log('1. فایل mcp-config-example.json را کپی کنید به:');
console.log('   ~/.config/cursor/mcp.json (Linux/Mac)');
console.log('   یا %APPDATA%\\Cursor\\mcp.json (Windows)\n');
console.log('2. Cursor را restart کنید\n');
console.log('3. در Cursor از tool search_centers استفاده کنید\n');

// تست ساده: بررسی اینکه فایل server وجود دارد
import { existsSync } from 'fs';

if (!existsSync(serverPath)) {
  console.error('❌ Server file not found:', serverPath);
  process.exit(1);
}

console.log('✅ Server file exists');
console.log('\nبرای تست دستی، می‌توانید از MCP client استفاده کنید.');


