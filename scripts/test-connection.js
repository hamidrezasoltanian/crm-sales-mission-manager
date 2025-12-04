#!/usr/bin/env node

/**
 * اسکریپت تست اتصال به MongoDB
 * استفاده: node scripts/test-connection.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// لود کردن فایل .env از پوشه backend
dotenv.config({ path: join(__dirname, '../backend/.env') });

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sales-mission-manager';

console.log('🔍 در حال تست اتصال به MongoDB...');
console.log(`📍 URI: ${mongoURI.replace(/:[^:@]+@/, ':****@')}`); // پنهان کردن رمز عبور

async function testConnection() {
  try {
    const startTime = Date.now();
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    const connectionTime = Date.now() - startTime;
    
    console.log('✅ اتصال موفق بود!');
    console.log(`⏱️  زمان اتصال: ${connectionTime}ms`);
    console.log(`📊 دیتابیس: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    console.log(`🔌 Port: ${mongoose.connection.port}`);
    
    // تست عملیات
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📁 تعداد Collection ها: ${collections.length}`);
    
    if (collections.length > 0) {
      console.log('   Collections موجود:');
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }
    
    // بستن اتصال
    await mongoose.connection.close();
    console.log('✅ اتصال بسته شد.');
    process.exit(0);
  } catch (error) {
    console.error('❌ خطا در اتصال:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 نکات:');
      console.error('   - بررسی کنید MongoDB در حال اجرا باشد');
      console.error('   - بررسی کنید آدرس و پورت صحیح باشد');
    } else if (error.message.includes('authentication failed')) {
      console.error('\n💡 نکات:');
      console.error('   - نام کاربری و رمز عبور را بررسی کنید');
      console.error('   - authSource را بررسی کنید');
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 نکات:');
      console.error('   - بررسی کنید Firewall تنظیمات صحیح داشته باشد');
      console.error('   - بررسی کنید MongoDB از راه دور قابل دسترسی باشد');
    }
    
    process.exit(1);
  }
}

testConnection();
