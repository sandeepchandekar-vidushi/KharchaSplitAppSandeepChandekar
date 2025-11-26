import { query, transaction  } from '../config/database.js';

class Group {
  /**
   * Find group by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT g.*,
              COUNT(DISTINCT gm.user_id) as member_count,
              COUNT(DISTINCT e.id) as expense_count,
              COALESCE(SUM(e.amount), 0) as total_expenses
       FROM groups g
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.deleted_at IS NULL
       LEFT JOIN expenses e ON g.id = e.group_id AND e.deleted_at IS NULL
       WHERE g.id = $1 AND g.deleted_at IS NULL
       GROUP BY g.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find groups by user ID
   */
  static async findByUserId(userId, limit = 20, offset = 0) {
    const result = await query(
      `SELECT g.id, g.name, g.description, g.cover_image_base64, g.created_by, g.created_at, g.updated_at,
              COUNT(DISTINCT gm2.user_id) as member_count,
              COUNT(DISTINCT e.id) as expense_count,
              COALESCE(SUM(e.amount), 0) as total_expenses
       FROM groups g
       INNER JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $1 AND gm.deleted_at IS NULL
       LEFT JOIN group_members gm2 ON g.id = gm2.group_id AND gm2.deleted_at IS NULL
       LEFT JOIN expenses e ON g.id = e.group_id AND e.deleted_at IS NULL
       WHERE g.deleted_at IS NULL
       GROUP BY g.id, g.name, g.description, g.cover_image_base64, g.created_by, g.created_at, g.updated_at
       ORDER BY g.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Create new group with members
   */
  static async create(groupData, members) {
    return transaction(async (client) => {
      // Create group
      const groupResult = await client.query(
        `INSERT INTO groups (name, description, cover_image_base64, currency, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [groupData.name, groupData.description || null, groupData.coverImageBase64 || null, groupData.currency || 'INR', groupData.createdBy]
      );
      const group = groupResult.rows[0];

      // Add creator as admin
      await client.query(
        `INSERT INTO group_members (group_id, user_id, name, phone_number, email, role, added_by)
         SELECT $1, $2, name, phone_number, email, 'creator', $2
         FROM users WHERE id = $2`,
        [group.id, groupData.createdBy]
      );

      // Add other members
      if (members && members.length > 0) {
        for (const member of members) {
          await client.query(
            `INSERT INTO group_members (group_id, user_id, name, phone_number, email, role, added_by)
             VALUES ($1, $2, $3, $4, $5, 'member', $6)`,
            [group.id, member.userId, member.name, member.phoneNumber || null, member.email || null, groupData.createdBy]
          );
        }
      }

      return group;
    });
  }

  /**
   * Update group
   */
  static async update(id, groupData) {
    const { name, description, coverImageBase64, currency } = groupData;
    const result = await query(
      `UPDATE groups
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           cover_image_base64 = COALESCE($3, cover_image_base64),
           currency = COALESCE($4, currency)
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING *`,
      [name, description, coverImageBase64, currency, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Soft delete group
   */
  static async delete(id) {
    const result = await query(
      'UPDATE groups SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Archive group
   */
  static async archive(id) {
    const result = await query(
      'UPDATE groups SET archived_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND archived_at IS NULL RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Unarchive group
   */
  static async unarchive(id) {
    const result = await query(
      'UPDATE groups SET archived_at = NULL WHERE id = $1 AND deleted_at IS NULL AND archived_at IS NOT NULL RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get group members
   */
  static async getMembers(groupId) {
    const result = await query(
      `SELECT gm.*, u.profile_image_base64
       FROM group_members gm
       LEFT JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1 AND gm.deleted_at IS NULL
       ORDER BY
         CASE gm.role
           WHEN 'creator' THEN 1
           WHEN 'admin' THEN 2
           ELSE 3
         END,
         gm.joined_at`,
      [groupId]
    );
    return result.rows;
  }

  /**
   * Add member to group
   * Handles re-adding previously removed members by reactivating their record
   */
  static async addMember(groupId, memberData) {
    // First, check if there's a soft-deleted record for this user
    const existingResult = await query(
      `SELECT id, deleted_at FROM group_members
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, memberData.userId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      if (existing.deleted_at === null) {
        // Member is already active - return conflict error
        throw new Error('User is already a member of this group');
      }

      // Reactivate the soft-deleted member
      const reactivateResult = await query(
        `UPDATE group_members
         SET deleted_at = NULL,
             name = $3,
             phone_number = $4,
             email = $5,
             role = $6,
             added_by = $7,
             joined_at = NOW()
         WHERE group_id = $1 AND user_id = $2
         RETURNING *`,
        [
          groupId,
          memberData.userId,
          memberData.name,
          memberData.phoneNumber || null,
          memberData.email || null,
          memberData.role || 'member',
          memberData.addedBy
        ]
      );
      return reactivateResult.rows[0];
    }

    // No existing record - insert new member
    const result = await query(
      `INSERT INTO group_members (group_id, user_id, name, phone_number, email, role, added_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        groupId,
        memberData.userId,
        memberData.name,
        memberData.phoneNumber || null,
        memberData.email || null,
        memberData.role || 'member',
        memberData.addedBy
      ]
    );
    return result.rows[0];
  }

  /**
   * Remove member from group
   */
  static async removeMember(groupId, userId) {
    const result = await query(
      'UPDATE group_members SET deleted_at = NOW() WHERE group_id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
      [groupId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Update member role
   */
  static async updateMemberRole(groupId, userId, role) {
    const result = await query(
      `UPDATE group_members
       SET role = $1
       WHERE group_id = $2 AND user_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [role, groupId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if user is group member
   */
  static async isMember(groupId, userId) {
    const result = await query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [groupId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if user is group admin/creator
   */
  static async isAdmin(groupId, userId) {
    const result = await query(
      "SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND role IN ('creator', 'admin') AND deleted_at IS NULL",
      [groupId, userId]
    );
    return result.rows.length > 0;
  }
}

export default Group;
