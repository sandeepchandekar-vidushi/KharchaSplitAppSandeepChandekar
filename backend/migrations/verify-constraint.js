import { pool } from '../src/config/database.js';

async function verifyConstraint() {
  try {
    // Check for UNIQUE constraint
    const constraintCheck = await pool.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conname = 'users_phone_number_unique'
    `);

    console.log('\n📋 Constraint Status:');
    if (constraintCheck.rows.length > 0) {
      console.log('✅ UNIQUE constraint exists on phone_number');
    } else {
      console.log('❌ UNIQUE constraint NOT found');
    }

    // Check for duplicate phone numbers
    const duplicateCheck = await pool.query(`
      SELECT phone_number, COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY phone_number
      HAVING COUNT(*) > 1
    `);

    console.log('\n📊 Duplicate Phone Numbers:');
    if (duplicateCheck.rows.length === 0) {
      console.log('✅ No duplicate phone numbers found');
    } else {
      console.log('❌ Found duplicates:');
      duplicateCheck.rows.forEach(row => {
        console.log(`   - ${row.phone_number}: ${row.count} times`);
      });
    }

    // Show total user count
    const countCheck = await pool.query(`
      SELECT COUNT(*) as total_users, COUNT(DISTINCT phone_number) as unique_phones
      FROM users
      WHERE deleted_at IS NULL
    `);

    console.log('\n📈 Database Stats:');
    console.log(`   Total users: ${countCheck.rows[0].total_users}`);
    console.log(`   Unique phone numbers: ${countCheck.rows[0].unique_phones}`);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyConstraint();
