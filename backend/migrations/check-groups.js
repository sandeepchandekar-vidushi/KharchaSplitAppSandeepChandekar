import { pool } from '../src/config/database.js';

async function checkGroups() {
  try {
    console.log('\n📋 Checking Groups and Members:\n');

    // Get all groups
    const groupsResult = await pool.query(`
      SELECT id, name, created_by, created_at, deleted_at
      FROM groups
      WHERE name = 'Pune Trip Nov 2025'
      ORDER BY created_at DESC
    `);

    console.log(`Total "Pune Trip Nov 2025" groups: ${groupsResult.rows.length}\n`);

    for (const group of groupsResult.rows) {
      console.log(`Group: ${group.name}`);
      console.log(`  ID: ${group.id}`);
      console.log(`  Created by: ${group.created_by}`);
      console.log(`  Created at: ${group.created_at}`);
      console.log(`  Deleted: ${group.deleted_at || 'No (active)'}`);

      // Get members for this group
      const membersResult = await pool.query(`
        SELECT gm.id, gm.user_id, gm.role, gm.deleted_at, u.name, u.phone_number
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = $1
        ORDER BY gm.created_at ASC
      `, [group.id]);

      console.log(`  Members: ${membersResult.rows.length}`);
      membersResult.rows.forEach((member, i) => {
        console.log(`    ${i + 1}. ${member.name || '[Unknown]'} (${member.phone_number})`);
        console.log(`       User ID: ${member.user_id}`);
        console.log(`       Role: ${member.role}`);
        console.log(`       Deleted: ${member.deleted_at || 'No (active)'}`);
      });
      console.log('');
    }

    // Check which user is logged in (the one creating groups)
    const creatorResult = await pool.query(`
      SELECT id, name, phone_number
      FROM users
      WHERE id = $1
    `, [groupsResult.rows[0]?.created_by]);

    if (creatorResult.rows.length > 0) {
      console.log('Group creator:');
      console.log(`  Name: ${creatorResult.rows[0].name}`);
      console.log(`  Phone: ${creatorResult.rows[0].phone_number}`);
      console.log(`  ID: ${creatorResult.rows[0].id}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkGroups();
