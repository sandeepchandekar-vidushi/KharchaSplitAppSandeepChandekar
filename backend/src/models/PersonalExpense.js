const { query } = require('../config/database');

class PersonalExpense {
  /**
   * Find personal expense by ID
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM personal_expenses WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find personal expenses by user ID
   */
  static async findByUserId(userId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT *
       FROM personal_expenses
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY expense_date DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Create new personal expense
   */
  static async create(expenseData) {
    const result = await query(
      `INSERT INTO personal_expenses (
        user_id, description, amount, currency, category,
        receipt_base64, notes, expense_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        expenseData.userId,
        expenseData.description,
        expenseData.amount,
        expenseData.currency || 'USD',
        expenseData.category || null,
        expenseData.receiptBase64 || null,
        expenseData.notes || null,
        expenseData.expenseDate || new Date()
      ]
    );
    return result.rows[0];
  }

  /**
   * Update personal expense
   */
  static async update(id, expenseData) {
    const result = await query(
      `UPDATE personal_expenses
       SET description = COALESCE($1, description),
           amount = COALESCE($2, amount),
           currency = COALESCE($3, currency),
           category = COALESCE($4, category),
           receipt_base64 = COALESCE($5, receipt_base64),
           notes = COALESCE($6, notes),
           expense_date = COALESCE($7, expense_date)
       WHERE id = $8 AND deleted_at IS NULL
       RETURNING *`,
      [
        expenseData.description,
        expenseData.amount,
        expenseData.currency,
        expenseData.category,
        expenseData.receiptBase64,
        expenseData.notes,
        expenseData.expenseDate,
        id
      ]
    );
    return result.rows[0] || null;
  }

  /**
   * Soft delete personal expense
   */
  static async delete(id) {
    const result = await query(
      'UPDATE personal_expenses SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get total count for pagination
   */
  static async countByUserId(userId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM personal_expenses WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get total expenses for user
   */
  static async getTotalByUserId(userId) {
    const result = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM personal_expenses WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return parseFloat(result.rows[0].total);
  }
}

module.exports = PersonalExpense;
