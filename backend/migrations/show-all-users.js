import { pool } from '../src/config/database.js';

async function showAllUsers() {
  try {
    console.log('\n📋 All Users in Database:\n');

    const result = await pool.query(`
      SELECT id, phone_number, name, email, created_at, deleted_at
      FROM users
      ORDER BY created_at ASC
    `);

    console.log(`Total users: ${result.rows.length}\n`);

    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Phone: ${user.phone_number}`);
      console.log(`   Email: ${user.email || '[null]'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Deleted: ${user.deleted_at || 'No (active)'}`);
      console.log('');
    });

    // Check specifically for the phone number in your screenshot
    const duplicateCheck = await pool.query(`
      SELECT phone_number, COUNT(*) as count,
             array_agg(id) as user_ids,
             array_agg(name) as names
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY phone_number
      HAVING COUNT(*) > 1
    `);

    if (duplicateCheck.rows.length > 0) {
      console.log('❌ Found duplicates:');
      duplicateCheck.rows.forEach(dup => {
        console.log(`   ${dup.phone_number}: ${dup.count} times`);
        console.log(`   Names: ${dup.names.join(', ')}`);
      });
    } else {
      console.log('✅ No duplicates found among active users');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

showAllUsers();
