const { query } = require('../config/database');

class Settlement {
  /**
   * Find settlement by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT s.*,
              u1.name as from_user_name, u1.profile_image_base64 as from_user_image,
              u2.name as to_user_name, u2.profile_image_base64 as to_user_image
       FROM settlements s
       LEFT JOIN users u1 ON s.from_user_id = u1.id
       LEFT JOIN users u2 ON s.to_user_id = u2.id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find settlements by group ID
   */
  static async findByGroupId(groupId) {
    const result = await query(
      `SELECT s.*,
              u1.name as from_user_name, u1.profile_image_base64 as from_user_image,
              u2.name as to_user_name, u2.profile_image_base64 as to_user_image
       FROM settlements s
       LEFT JOIN users u1 ON s.from_user_id = u1.id
       LEFT JOIN users u2 ON s.to_user_id = u2.id
       WHERE s.group_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.created_at DESC`,
      [groupId]
    );
    return result.rows;
  }

  /**
   * Create new settlement
   */
  static async create(settlementData) {
    const result = await query(
      `INSERT INTO settlements (
        group_id, from_user_id, to_user_id, amount, currency, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        settlementData.groupId,
        settlementData.fromUserId,
        settlementData.toUserId,
        settlementData.amount,
        settlementData.currency || 'USD',
        settlementData.status || 'pending',
        settlementData.notes || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Confirm settlement
   */
  static async confirm(id) {
    const result = await query(
      `UPDATE settlements
       SET status = 'paid',
           confirmed_at = NOW()
       WHERE id = $1 AND status = 'pending' AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update settlement
   */
  static async update(id, settlementData) {
    const result = await query(
      `UPDATE settlements
       SET amount = COALESCE($1, amount),
           notes = COALESCE($2, notes)
       WHERE id = $3 AND status = 'pending' AND deleted_at IS NULL
       RETURNING *`,
      [settlementData.amount, settlementData.notes, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Soft delete settlement
   */
  static async delete(id) {
    const result = await query(
      'UPDATE settlements SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }
}

module.exports = Settlement;
