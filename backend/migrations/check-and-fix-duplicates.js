import { pool } from '../src/config/database.js';

async function checkAndFixDuplicates() {
  try {
    console.log('\n🔍 Checking for duplicate phone numbers...\n');

    // Find all duplicates with details
    const duplicateCheck = await pool.query(`
      SELECT phone_number, json_agg(json_build_object(
        'id', id,
        'name', name,
        'email', email,
        'created_at', created_at
      ) ORDER BY created_at ASC) as users
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY phone_number
      HAVING COUNT(*) > 1
    `);

    if (duplicateCheck.rows.length === 0) {
      console.log('✅ No duplicate phone numbers found!');
      process.exit(0);
      return;
    }

    console.log(`❌ Found ${duplicateCheck.rows.length} duplicate phone number(s):\n`);

    for (const duplicate of duplicateCheck.rows) {
      console.log(`Phone: ${duplicate.phone_number}`);
      console.log(`  Users (${duplicate.users.length}):`);
      duplicate.users.forEach((user, index) => {
        console.log(`    ${index + 1}. ID: ${user.id}, Name: ${user.name}, Created: ${user.created_at}`);
      });

      // Keep the first (oldest) user, delete the rest
      const usersToDelete = duplicate.users.slice(1);
      console.log(`  → Keeping oldest user (${duplicate.users[0].name})`);
      console.log(`  → Deleting ${usersToDelete.length} duplicate(s)...\n`);

      for (const userToDelete of usersToDelete) {
        await pool.query('DELETE FROM users WHERE id = $1', [userToDelete.id]);
        console.log(`     ✓ Deleted user: ${userToDelete.name} (${userToDelete.id})`);
      }
    }

    // Verify fix
    const verifyCheck = await pool.query(`
      SELECT phone_number, COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY phone_number
      HAVING COUNT(*) > 1
    `);

    console.log('\n📊 Verification:');
    if (verifyCheck.rows.length === 0) {
      console.log('✅ All duplicates have been removed!');

      const totalCheck = await pool.query(`
        SELECT COUNT(*) as total
        FROM users
        WHERE deleted_at IS NULL
      `);
      console.log(`📈 Total remaining users: ${totalCheck.rows[0].total}\n`);
    } else {
      console.log('❌ Still have duplicates - something went wrong');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndFixDuplicates();
