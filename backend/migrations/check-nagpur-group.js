import { pool } from '../src/config/database.js';

async function checkGroup() {
  try {
    console.log('\n📋 Checking Nagpur Trip Group:\n');

    // Get the group
    const groupResult = await pool.query(`
      SELECT g.*,
             (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.deleted_at IS NULL) as member_count
      FROM groups g
      WHERE g.name LIKE '%Nagpur%' AND g.deleted_at IS NULL
      ORDER BY g.created_at DESC
      LIMIT 1
    `);

    if (groupResult.rows.length === 0) {
      console.log('❌ No Nagpur Trip group found');
      process.exit(0);
    }

    const group = groupResult.rows[0];
    console.log('Group Details:');
    console.log('  ID:', group.id);
    console.log('  Name:', group.name);
    console.log('  Created By:', group.created_by);
    console.log('  Member Count:', group.member_count);
    console.log('');

    // Get all members
    const membersResult = await pool.query(`
      SELECT gm.*, u.name as user_name, u.phone_number
      FROM group_members gm
      LEFT JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1 AND gm.deleted_at IS NULL
      ORDER BY
        CASE gm.role
          WHEN 'creator' THEN 1
          WHEN 'admin' THEN 2
          ELSE 3
        END,
        gm.joined_at
    `, [group.id]);

    console.log(`Members (${membersResult.rows.length}):`);
    membersResult.rows.forEach((member, i) => {
      console.log(`  ${i + 1}. ${member.name} (${member.user_name || 'N/A'})`);
      console.log(`     User ID: ${member.user_id}`);
      console.log(`     Role: ${member.role}`);
      console.log(`     Phone: ${member.phone_number || 'N/A'}`);
      console.log(`     Added By: ${member.added_by}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkGroup();
