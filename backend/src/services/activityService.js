const Activity = require('../models/Activity');

/**
 * Activity Service
 * Handles activity logging and notification logic
 */
class ActivityService {
  /**
   * Activity Types Constants
   */
  static ACTIVITY_TYPES = {
    GROUP_CREATED: 'group_created',
    GROUP_UPDATED: 'group_updated',
    MEMBER_ADDED: 'member_added',
    MEMBER_REMOVED: 'member_removed',
    MEMBER_ROLE_UPDATED: 'member_role_updated',
    EXPENSE_ADDED: 'expense_added',
    EXPENSE_UPDATED: 'expense_updated',
    EXPENSE_DELETED: 'expense_deleted',
    SETTLEMENT_CREATED: 'settlement_created',
    SETTLEMENT_CONFIRMED: 'settlement_confirmed',
    SETTLEMENT_DELETED: 'settlement_deleted',
  };

  /**
   * Entity Types Constants
   */
  static ENTITY_TYPES = {
    GROUP: 'group',
    MEMBER: 'member',
    EXPENSE: 'expense',
    SETTLEMENT: 'settlement',
  };

  /**
   * Log group created activity
   */
  static async logGroupCreated(groupId, userId, groupName) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.GROUP_CREATED,
      entityType: this.ENTITY_TYPES.GROUP,
      entityId: groupId,
      title: 'Group created',
      description: `Created group "${groupName}"`,
      metadata: { groupName },
    });
  }

  /**
   * Log group updated activity
   */
  static async logGroupUpdated(groupId, userId, groupName, changes) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.GROUP_UPDATED,
      entityType: this.ENTITY_TYPES.GROUP,
      entityId: groupId,
      title: 'Group updated',
      description: `Updated group "${groupName}"`,
      metadata: { groupName, changes },
    });
  }

  /**
   * Log member added activity
   */
  static async logMemberAdded(groupId, userId, groupName, memberName) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.MEMBER_ADDED,
      entityType: this.ENTITY_TYPES.MEMBER,
      entityId: groupId,
      title: 'Member added',
      description: `${memberName} joined "${groupName}"`,
      metadata: { groupName, memberName },
    });
  }

  /**
   * Log member removed activity
   */
  static async logMemberRemoved(groupId, userId, groupName, memberName) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.MEMBER_REMOVED,
      entityType: this.ENTITY_TYPES.MEMBER,
      entityId: groupId,
      title: 'Member removed',
      description: `${memberName} left "${groupName}"`,
      metadata: { groupName, memberName },
    });
  }

  /**
   * Log member role updated activity
   */
  static async logMemberRoleUpdated(groupId, userId, groupName, memberName, newRole) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.MEMBER_ROLE_UPDATED,
      entityType: this.ENTITY_TYPES.MEMBER,
      entityId: groupId,
      title: 'Member role updated',
      description: `${memberName} is now ${newRole} in "${groupName}"`,
      metadata: { groupName, memberName, newRole },
    });
  }

  /**
   * Log expense added activity
   */
  static async logExpenseAdded(expenseId, groupId, userId, groupName, description, amount, currency) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.EXPENSE_ADDED,
      entityType: this.ENTITY_TYPES.EXPENSE,
      entityId: expenseId,
      title: 'Expense added',
      description: `Added "${description}" for ${currency} ${amount.toFixed(2)} in "${groupName}"`,
      metadata: { groupName, expenseDescription: description, amount, currency },
    });
  }

  /**
   * Log expense updated activity
   */
  static async logExpenseUpdated(expenseId, groupId, userId, groupName, description, amount, currency) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.EXPENSE_UPDATED,
      entityType: this.ENTITY_TYPES.EXPENSE,
      entityId: expenseId,
      title: 'Expense updated',
      description: `Updated "${description}" in "${groupName}"`,
      metadata: { groupName, expenseDescription: description, amount, currency },
    });
  }

  /**
   * Log expense deleted activity
   */
  static async logExpenseDeleted(expenseId, groupId, userId, groupName, description) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.EXPENSE_DELETED,
      entityType: this.ENTITY_TYPES.EXPENSE,
      entityId: expenseId,
      title: 'Expense deleted',
      description: `Deleted "${description}" from "${groupName}"`,
      metadata: { groupName, expenseDescription: description },
    });
  }

  /**
   * Log settlement created activity
   */
  static async logSettlementCreated(settlementId, groupId, fromUserId, toUserId, groupName, fromName, toName, amount, currency) {
    return await Activity.create({
      groupId,
      userId: fromUserId,
      activityType: this.ACTIVITY_TYPES.SETTLEMENT_CREATED,
      entityType: this.ENTITY_TYPES.SETTLEMENT,
      entityId: settlementId,
      title: 'Settlement created',
      description: `${fromName} paid ${toName} ${currency} ${amount.toFixed(2)} in "${groupName}"`,
      metadata: { groupName, fromName, toName, amount, currency },
    });
  }

  /**
   * Log settlement confirmed activity
   */
  static async logSettlementConfirmed(settlementId, groupId, fromUserId, toUserId, groupName, fromName, toName, amount, currency) {
    return await Activity.create({
      groupId,
      userId: toUserId,
      activityType: this.ACTIVITY_TYPES.SETTLEMENT_CONFIRMED,
      entityType: this.ENTITY_TYPES.SETTLEMENT,
      entityId: settlementId,
      title: 'Settlement confirmed',
      description: `${toName} confirmed payment of ${currency} ${amount.toFixed(2)} from ${fromName} in "${groupName}"`,
      metadata: { groupName, fromName, toName, amount, currency },
    });
  }

  /**
   * Log settlement deleted activity
   */
  static async logSettlementDeleted(settlementId, groupId, userId, groupName, fromName, toName) {
    return await Activity.create({
      groupId,
      userId,
      activityType: this.ACTIVITY_TYPES.SETTLEMENT_DELETED,
      entityType: this.ENTITY_TYPES.SETTLEMENT,
      entityId: settlementId,
      title: 'Settlement deleted',
      description: `Deleted settlement between ${fromName} and ${toName} in "${groupName}"`,
      metadata: { groupName, fromName, toName },
    });
  }
}

module.exports = ActivityService;
