import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../data/shared.db');

async function checkSchema() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  const columns = await db.all("PRAGMA table_info(personnel)");
  console.log('Columns in personnel:', columns.map(c => c.name));
  await db.close();
}

checkSchema();


