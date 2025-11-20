const { query, transaction } = require('../config/database');

class Expense {
  /**
   * Find expense by ID with participants
   */
  static async findById(id) {
    const expenseResult = await query(
      `SELECT e.*, u.name as paid_by_name, u.profile_image_base64 as paid_by_image
       FROM expenses e
       LEFT JOIN users u ON e.paid_by_id = u.id
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id]
    );

    if (expenseResult.rows.length === 0) {
      return null;
    }

    const expense = expenseResult.rows[0];

    // Get participants
    const participantsResult = await query(
      `SELECT ep.*, u.profile_image_base64
       FROM expense_participants ep
       LEFT JOIN users u ON ep.user_id = u.id
       WHERE ep.expense_id = $1
       ORDER BY ep.amount DESC`,
      [id]
    );

    expense.participants = participantsResult.rows;
    return expense;
  }

  /**
   * Find expenses by group ID
   */
  static async findByGroupId(groupId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT e.*, u.name as paid_by_name, u.profile_image_base64 as paid_by_image,
              COUNT(ep.id) as participant_count
       FROM expenses e
       LEFT JOIN users u ON e.paid_by_id = u.id
       LEFT JOIN expense_participants ep ON e.id = ep.expense_id
       WHERE e.group_id = $1 AND e.deleted_at IS NULL
       GROUP BY e.id, u.name, u.profile_image_base64
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Create new expense with participants
   */
  static async create(expenseData, participants) {
    return transaction(async (client) => {
      // Create expense
      const expenseResult = await client.query(
        `INSERT INTO expenses (
          group_id, description, amount, currency, category,
          paid_by_id, paid_by_name, split_type, receipt_base64, notes, expense_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          expenseData.groupId,
          expenseData.description,
          expenseData.amount,
          expenseData.currency || 'USD',
          expenseData.category || null,
          expenseData.paidById,
          expenseData.paidByName,
          expenseData.splitType || 'equal',
          expenseData.receiptBase64 || null,
          expenseData.notes || null,
          expenseData.expenseDate || new Date()
        ]
      );
      const expense = expenseResult.rows[0];

      // Add participants
      if (participants && participants.length > 0) {
        for (const participant of participants) {
          await client.query(
            `INSERT INTO expense_participants (
              expense_id, user_id, name, amount, percentage, shares
            )
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              expense.id,
              participant.userId,
              participant.name,
              participant.amount,
              participant.percentage || null,
              participant.shares || null
            ]
          );
        }
      }

      return expense;
    });
  }

  /**
   * Update expense
   */
  static async update(id, expenseData) {
    const result = await query(
      `UPDATE expenses
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
   * Soft delete expense
   */
  static async delete(id) {
    const result = await query(
      'UPDATE expenses SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Get total count for pagination
   */
  static async countByGroupId(groupId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM expenses WHERE group_id = $1 AND deleted_at IS NULL',
      [groupId]
    );
    return parseInt(result.rows[0].count);
  }
}

module.exports = Expense;
