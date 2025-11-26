import Group from '../models/Group.js';
import User from '../models/User.js';
import { query } from '../config/database.js';

class GroupService {
  /**
   * Calculate group balances
   */
  static async calculateBalances(groupId) {

    // Get all expenses for this group
    const expensesResult = await query(
      `SELECT e.id, e.paid_by_id, e.amount,
              json_agg(
                json_build_object(
                  'user_id', ep.user_id,
                  'amount', ep.amount
                )
              ) as participants
       FROM expenses e
       LEFT JOIN expense_participants ep ON e.id = ep.expense_id
       WHERE e.group_id = $1 AND e.deleted_at IS NULL
       GROUP BY e.id`,
      [groupId]
    );

    const balances = {};

    // Calculate balances
    for (const expense of expensesResult.rows) {
      const paidById = expense.paid_by_id;

      if (expense.participants) {
        for (const participant of expense.participants) {
          if (participant.user_id !== paidById) {
            // Initialize balance objects
            if (!balances[participant.user_id]) balances[participant.user_id] = {};
            if (!balances[paidById]) balances[paidById] = {};

            // Participant owes payer
            if (!balances[participant.user_id][paidById]) {
              balances[participant.user_id][paidById] = 0;
            }
            balances[participant.user_id][paidById] += parseFloat(participant.amount);
          }
        }
      }
    }

    // Simplify balances (net out opposing debts)
    const simplifiedBalances = [];

    for (const debtor in balances) {
      for (const creditor in balances[debtor]) {
        let amount = balances[debtor][creditor];

        // Check if there's a reverse balance
        if (balances[creditor] && balances[creditor][debtor]) {
          const reverseAmount = balances[creditor][debtor];
          amount -= reverseAmount;
          delete balances[creditor][debtor];
        }

        if (amount > 0) {
          simplifiedBalances.push({
            fromUserId: debtor,
            toUserId: creditor,
            amount: amount.toFixed(2)
          });
        } else if (amount < 0) {
          simplifiedBalances.push({
            fromUserId: creditor,
            toUserId: debtor,
            amount: Math.abs(amount).toFixed(2)
          });
        }
      }
    }

    return simplifiedBalances;
  }

  /**
   * Validate group access
   */
  static async validateGroupAccess(groupId, userId) {
    const isMember = await Group.isMember(groupId, userId);
    if (!isMember) {
      throw new Error('User is not a member of this group');
    }
    return true;
  }

  /**
   * Validate admin access
   */
  static async validateAdminAccess(groupId, userId) {
    const isAdmin = await Group.isAdmin(groupId, userId);
    if (!isAdmin) {
      throw new Error('User is not an admin of this group');
    }
    return true;
  }
}

export default GroupService;
