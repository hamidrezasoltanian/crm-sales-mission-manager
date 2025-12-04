# اسکریپت PowerShell برای تست اتصال به MongoDB

Write-Host "🔍 در حال تست اتصال به MongoDB..." -ForegroundColor Cyan

# دریافت مسیر فایل .env
$envPath = Join-Path $PSScriptRoot "..\backend\.env"

# خواندن MONGODB_URI از .env
$mongoURI = "mongodb://localhost:27017/sales-mission-manager"

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath | Where-Object { $_ -match "^MONGODB_URI=" }
    if ($envContent) {
        $mongoURI = $envContent -replace "MONGODB_URI=", ""
    }
} else {
    Write-Host "⚠️  فایل .env پیدا نشد. از مقدار پیش‌فرض استفاده می‌شود." -ForegroundColor Yellow
}

# پنهان کردن رمز عبور در خروجی
$displayURI = $mongoURI -replace ":([^:@]+)@", ":****@"
Write-Host "📍 URI: $displayURI" -ForegroundColor Gray

# تست اتصال با Node.js
$testScript = @"
import mongoose from 'mongoose';
const uri = '$mongoURI';
const startTime = Date.now();
try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const time = Date.now() - startTime;
    console.log('✅ اتصال موفق بود!');
    console.log(\`⏱️  زمان اتصال: \${time}ms\`);
    console.log(\`📊 دیتابیس: \${mongoose.connection.name}\`);
    console.log(\`🌐 Host: \${mongoose.connection.host}\`);
    console.log(\`🔌 Port: \${mongoose.connection.port}\`);
    await mongoose.connection.close();
    process.exit(0);
} catch (error) {
    console.error('❌ خطا در اتصال:');
    console.error(\`   \${error.message}\`);
    process.exit(1);
}
"@

$tempScript = Join-Path $env:TEMP "test-mongo-connection-$(Get-Random).mjs"
$testScript | Out-File -FilePath $tempScript -Encoding UTF8

try {
    Push-Location (Join-Path $PSScriptRoot "..")
    node $tempScript
    $result = $LASTEXITCODE
} finally {
    Remove-Item $tempScript -ErrorAction SilentlyContinue
    Pop-Location
}

if ($result -ne 0) {
    Write-Host "`n💡 نکات:" -ForegroundColor Yellow
    Write-Host "  - بررسی کنید MongoDB در حال اجرا باشد"
    Write-Host "  - بررسی کنید آدرس و پورت صحیح باشد"
    Write-Host "  - بررسی کنید Firewall تنظیمات صحیح داشته باشد"
}
