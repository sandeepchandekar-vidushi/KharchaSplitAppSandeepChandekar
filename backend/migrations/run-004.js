import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration004() {
  console.log('🚀 Running migration 004: Fix duplicate phone numbers...\n');

  try {
    const sqlPath = path.join(__dirname, '004_fix_duplicate_phone_numbers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Executing SQL...');
    await pool.query(sql);
    console.log('✅ Migration 004 completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration004();
