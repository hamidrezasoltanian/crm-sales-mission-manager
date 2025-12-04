# راهنمای نصب و راه‌اندازی MCP Server برای پیشنهاد مراکز

## پیش‌نیازها

- Node.js نصب شده باشد
- دیتابیس SQLite در مسیر `/home/hamidreza/App/sales-mission-manager/backend/data/shared.db` موجود باشد

## نصب

```bash
cd /home/hamidreza/App/sales-mission-manager/backend
npm install
```

## راه‌اندازی در Cursor

### مرحله 1: ایجاد فایل تنظیمات

فایل تنظیمات MCP را در مسیر زیر ایجاد کنید:

**Linux:**
```bash
mkdir -p ~/.config/cursor
cp src/mcp/mcp-config-example.json ~/.config/cursor/mcp.json
```

**Windows:**
```powershell
# در PowerShell
$configPath = "$env:APPDATA\Cursor"
New-Item -ItemType Directory -Force -Path $configPath
Copy-Item "src\mcp\mcp-config-example.json" "$configPath\mcp.json"
```

### مرحله 2: ویرایش مسیرها (در صورت نیاز)

اگر مسیر پروژه شما متفاوت است، فایل `~/.config/cursor/mcp.json` را ویرایش کنید:

```json
{
  "mcpServers": {
    "center-suggestions": {
      "command": "node",
      "args": [
        "/home/hamidreza/App/sales-mission-manager/backend/src/mcp/centerSuggestionsServer.js"
      ],
      "env": {
        "DB_PATH": "/home/hamidreza/App/sales-mission-manager/backend/data",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### مرحله 3: Restart Cursor

Cursor را ببندید و دوباره باز کنید تا تنظیمات MCP اعمال شود.

### مرحله 4: تست

در Cursor، می‌توانید از tool `search_centers` استفاده کنید. برای مثال:

```
لطفاً مراکز مشابه "نیکان" را پیدا کن
```

یا در کد:

```javascript
// MCP tool will be called automatically
// when AI needs to search for centers
```

## راه‌اندازی در Claude Desktop

### مرحله 1: ایجاد فایل تنظیمات

**macOS:**
```bash
mkdir -p ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```powershell
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
```

فایل `claude_desktop_config.json` را ویرایش کنید:

```json
{
  "mcpServers": {
    "center-suggestions": {
      "command": "node",
      "args": [
        "C:\\path\\to\\sales-mission-manager\\backend\\src\\mcp\\centerSuggestionsServer.js"
      ],
      "env": {
        "DB_PATH": "C:\\path\\to\\sales-mission-manager\\backend\\data",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### مرحله 2: Restart Claude Desktop

Claude Desktop را ببندید و دوباره باز کنید.

## تست دستی

برای تست مستقیم MCP server:

```bash
cd /home/hamidreza/App/sales-mission-manager/backend
node src/mcp/test-mcp.js
```

## Troubleshooting

### خطای "Database not initialized"

1. بررسی کنید که دیتابیس در مسیر صحیح وجود دارد:
   ```bash
   ls -la /home/hamidreza/App/sales-mission-manager/backend/data/shared.db
   ```

2. بررسی متغیر محیطی:
   ```bash
   echo $DB_PATH
   ```

3. در فایل `mcp.json` مسیر `DB_PATH` را تنظیم کنید.

### خطای "Module not found"

```bash
cd /home/hamidreza/App/sales-mission-manager/backend
npm install
```

### MCP Server در Cursor کار نمی‌کند

1. بررسی کنید که فایل `mcp.json` در مسیر صحیح است
2. Cursor را restart کنید
3. در Cursor Settings > Features > MCP بررسی کنید که MCP فعال است
4. لاگ‌های Cursor را بررسی کنید

## ویژگی‌های MCP Server

- ✅ فقط از مراکز موجود در دیتابیس پیشنهاد می‌دهد
- ✅ جستجوی هوشمند با fuzzy matching
- ✅ امتیازدهی بر اساس relevance
- ✅ پشتیبانی از فیلتر شهر و استان
- ✅ مرتب‌سازی نتایج

## مثال استفاده

وقتی در Cursor می‌گویید:

```
می‌خوام برای مرکز "نیکان" یک ماموریت ثبت کنم
```

MCP server به صورت خودکار:
1. نام "نیکان" را در دیتابیس جستجو می‌کند
2. اگر پیدا نشد، مراکز مشابه را پیشنهاد می‌دهد
3. فقط از لیست موجود در دیتابیس پیشنهاد می‌دهد

## پشتیبانی

برای مشکلات یا سوالات، لاگ‌های MCP server را بررسی کنید. MCP server از `console.error` برای لاگ استفاده می‌کند.


