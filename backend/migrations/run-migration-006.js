/**
 * Run migration 006: Add FCM token to users table
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kharchasplit',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Starting migration 006: Add FCM token to users...\n');

    // Read and execute migration SQL
    const migrationPath = path.join(__dirname, '006_add_fcm_token_to_users.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await client.query(migrationSQL);
    console.log('✓ Migration 006 completed successfully!\n');

    // Verify the columns were added
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('fcm_token', 'fcm_token_updated_at')
      ORDER BY column_name
    `);

    console.log('Verified columns in users table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\nMigration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
