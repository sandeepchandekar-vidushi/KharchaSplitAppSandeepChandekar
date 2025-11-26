import { pool } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('\n🔄 Running migration 005: Add archived_at to groups...\n');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '005_add_archived_at_to_groups.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);

    console.log('✅ Migration 005 completed successfully!\n');
    console.log('   - Added archived_at column to groups table');
    console.log('   - Created index on archived_at column\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
