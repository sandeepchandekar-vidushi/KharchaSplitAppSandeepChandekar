const { query } = require('../config/database');

/**
 * Activity Model
 * Handles activity feed and notification data
 */
class Activity {
  /**
   * Find activity by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT * FROM activities
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get activities for a user
   */
  static async findByUserId(userId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT a.*,
              u.name as actor_name,
              g.name as group_name
       FROM activities a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN groups g ON a.group_id = g.id
       WHERE a.user_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get activities for a group
   */
  static async findByGroupId(groupId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT a.*,
              u.name as actor_name,
              g.name as group_name
       FROM activities a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN groups g ON a.group_id = g.id
       WHERE a.group_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get unread activities count for user
   */
  static async getUnreadCount(userId) {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM activities
       WHERE user_id = $1 AND is_read = FALSE AND deleted_at IS NULL`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Create new activity
   */
  static async create(activityData) {
    const {
      groupId,
      userId,
      activityType,
      entityType,
      entityId,
      title,
      description,
      metadata,
    } = activityData;

    const result = await query(
      `INSERT INTO activities (
        group_id, user_id, activity_type, entity_type, entity_id,
        title, description, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        groupId || null,
        userId,
        activityType,
        entityType,
        entityId,
        title,
        description || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Mark activity as read
   */
  static async markAsRead(id, userId) {
    const result = await query(
      `UPDATE activities
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark all activities as read for a user
   */
  static async markAllAsRead(userId) {
    await query(
      `UPDATE activities
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE AND deleted_at IS NULL`,
      [userId]
    );
    return true;
  }

  /**
   * Mark all activities as read for a group
   */
  static async markGroupActivitiesAsRead(groupId, userId) {
    await query(
      `UPDATE activities
       SET is_read = TRUE
       WHERE group_id = $1 AND user_id = $2 AND is_read = FALSE AND deleted_at IS NULL`,
      [groupId, userId]
    );
    return true;
  }

  /**
   * Delete activity (soft delete)
   */
  static async delete(id) {
    const result = await query(
      `UPDATE activities
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Count total activities for a user
   */
  static async countByUserId(userId) {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM activities
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Count total activities for a group
   */
  static async countByGroupId(groupId) {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM activities
       WHERE group_id = $1 AND deleted_at IS NULL`,
      [groupId]
    );
    return parseInt(result.rows[0].count);
  }
}

module.exports = Activity;
