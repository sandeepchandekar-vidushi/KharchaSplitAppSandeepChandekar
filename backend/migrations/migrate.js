import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of migration files in order
const migrations = [
  '001_initial_schema.sql',
  '002_add_currency_to_groups.sql',
  '003_add_preferred_currency_to_users.sql',
  '004_fix_duplicate_phone_numbers.sql',
];

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  try {
    // Run each migration in sequence
    for (const migrationFile of migrations) {
      const sqlPath = path.join(__dirname, migrationFile);

      // Check if file exists
      if (!fs.existsSync(sqlPath)) {
        console.log(`⚠️  Skipping ${migrationFile} - file not found`);
        continue;
      }

      console.log(`📝 Running migration: ${migrationFile}`);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      // Execute the migration
      await pool.query(sql);
      console.log(`✅ Completed: ${migrationFile}\n`);
    }

    console.log('✅ All migrations completed successfully!\n');
    console.log('📊 Database schema includes:');
    console.log('   - users');
    console.log('   - groups (with currency field)');
    console.log('   - group_members');
    console.log('   - expenses');
    console.log('   - expense_participants');
    console.log('   - settlements');
    console.log('   - personal_expenses');
    console.log('   - otps');
    console.log('   - refresh_tokens');
    console.log('   - sync_metadata');
    console.log('   - All indexes and triggers\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
