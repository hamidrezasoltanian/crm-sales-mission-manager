import { connectDB, getDB, autoSave } from '../src/config/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function resetAssignmentCounter() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    const db = getDB();
    
    // بررسی وجود جدول sqlite_sequence
    const checkSequence = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'");
    
    if (checkSequence.length > 0 && checkSequence[0].values.length > 0) {
      // Reset شمارنده assignments
      console.log('🔄 Resetting assignment counter...');
      db.run("DELETE FROM sqlite_sequence WHERE name='assignments'");
      console.log('✅ Assignment counter reset successfully');
      
      // نمایش شمارنده فعلی (باید 0 باشد)
      const currentSeq = db.exec("SELECT seq FROM sqlite_sequence WHERE name='assignments'");
      if (currentSeq.length === 0 || currentSeq[0].values.length === 0) {
        console.log('✅ Assignment counter is now at 0');
      } else {
        console.log(`📊 Current assignment counter: ${currentSeq[0].values[0][0]}`);
      }
    } else {
      console.log('ℹ️  sqlite_sequence table does not exist yet (no auto-increment values to reset)');
      console.log('✅ Next assignment will start from ID 1');
    }
    
    // ذخیره تغییرات
    const dbDir = process.env.DB_PATH || join(__dirname, '../../data');
    const dbPath = join(dbDir, 'missions.db');
    autoSave();
    
    console.log('✅ Database saved successfully');
    console.log('📊 Next assignment ID will be: 1');
    
  } catch (error) {
    console.error('❌ Error resetting assignment counter:', error);
    process.exit(1);
  }
}

resetAssignmentCounter();

