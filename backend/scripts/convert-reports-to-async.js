#!/usr/bin/env node

/**
 * اسکریپت برای تبدیل reports.js به async
 * این اسکریپت:
 * 1. تمام route handlers را async می‌کند
 * 2. تمام db.exec() را به await db.all() یا await db.get() تبدیل می‌کند
 * 3. helper functions را به‌روزرسانی می‌کند
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPORTS_FILE = join(__dirname, '../src/routes/reports.js');

let content = readFileSync(REPORTS_FILE, 'utf8');

// 1. تبدیل route handlers به async
content = content.replace(/router\.(get|post|put|delete|patch)\('([^']+)',\s*\(req,\s*res\)\s*=>/g, 
  'router.$1(\'$2\', async (req, res) =>');

// 2. تبدیل db.exec() به await db.all() یا await db.get()
// برای SELECT COUNT(*) یا SELECT با یک ستون
content = content.replace(/const\s+(\w+)\s*=\s*db\.exec\(`([^`]+)`([^)]*)\);/g, (match, varName, query, params) => {
  const queryLower = query.toLowerCase().trim();
  
  // اگر COUNT یا SUM یا MAX یا MIN دارد، از db.get استفاده کن
  if (queryLower.includes('count(') || queryLower.includes('sum(') || 
      queryLower.includes('max(') || queryLower.includes('min(') ||
      queryLower.includes('avg(')) {
    return `const ${varName} = await db.get(\`${query}\`${params});`;
  }
  
  // در غیر این صورت از db.all استفاده کن
  return `const ${varName} = await db.all(\`${query}\`${params});`;
});

// 3. تبدیل formatResults و formatGroupResults برای کار با sqlite3
// این functions دیگر نیاز ندارند چون sqlite3 خودش object برمی‌گرداند
// اما باید آنها را نگه داریم برای backward compatibility

// 4. تبدیل formatResults برای کار با array از objects
content = content.replace(/function formatResults\(result\) \{[\s\S]*?\n\}/g, 
  `function formatResults(result) {
  // sqlite3 خودش array از objects برمی‌گرداند
  if (Array.isArray(result)) {
    return result;
  }
  // اگر از sql.js آمده باشد (backward compatibility)
  if (!result.length || !result[0].values.length) {
    return [];
  }
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}`);

content = content.replace(/function formatGroupResults\(result\) \{[\s\S]*?\n\}/g,
  `function formatGroupResults(result) {
  // sqlite3 خودش array از objects برمی‌گرداند
  if (Array.isArray(result)) {
    return result;
  }
  // اگر از sql.js آمده باشد (backward compatibility)
  if (!result.length || !result[0].values.length) {
    return [];
  }
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}`);

// 5. تبدیل دسترسی به values (مثل totalResult[0].values[0][0])
// این باید به result.count یا result.total تبدیل شود
content = content.replace(/(\w+)\[0\]\.values\[0\]\[0\]/g, (match, varName) => {
  return `${varName}.count || ${varName}.total || 0`;
});

// 6. تبدیل دسترسی به values برای arrays
content = content.replace(/(\w+)\[0\]\.values\[(\d+)\]/g, (match, varName, index) => {
  return `${varName}[${index}]`;
});

writeFileSync(REPORTS_FILE, content, 'utf8');
console.log('✅ reports.js به async تبدیل شد');

