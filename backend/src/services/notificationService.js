/**
 * Notification Service
 * Handles sending push notifications via Firebase Cloud Messaging (FCM)
 */

const admin = require('firebase-admin');
const { query } = require('../config/database');

// Initialize Firebase Admin SDK (if not already initialized)
let firebaseApp;
try {
  firebaseApp = admin.app();
} catch (error) {
  // Firebase not initialized yet - will be initialized in server.js
  console.log('[NotificationService] Firebase Admin not initialized yet');
}

/**
 * Notification types and their configurations
 */
const NOTIFICATION_TYPES = {
  // Settlement notifications
  SETTLEMENT_CREATED: {
    title: '💰 Payment Initiated',
    getBody: (data) => `${data.fromUserName} marked payment of ${data.currency}${data.amount} to ${data.toUserName}`,
    channelId: 'payments',
  },
  SETTLEMENT_CONFIRMED: {
    title: '✅ Payment Confirmed',
    getBody: (data) => `${data.toUserName} confirmed receiving ${data.currency}${data.amount} from ${data.fromUserName}`,
    channelId: 'payments',
  },

  // Group notifications
  GROUP_ARCHIVED: {
    title: '📦 Group Archived',
    getBody: (data) => `"${data.groupName}" has been archived`,
    channelId: 'groups',
  },
  GROUP_COMPLETED: {
    title: '✅ Group Closed',
    getBody: (data) => `"${data.groupName}" has been marked as complete`,
    channelId: 'groups',
  },
  GROUP_DELETED: {
    title: '🗑️ Group Deleted',
    getBody: (data) => `"${data.groupName}" has been deleted`,
    channelId: 'groups',
  },

  // Member notifications
  MEMBER_REMOVED: {
    title: '👤 Member Removed',
    getBody: (data) => `${data.memberName} was removed from "${data.groupName}"`,
    channelId: 'groups',
  },
  MEMBER_LEFT: {
    title: '👋 Member Left',
    getBody: (data) => `${data.memberName} left "${data.groupName}"`,
    channelId: 'groups',
  },
  MEMBER_ADDED: {
    title: '👤 New Member',
    getBody: (data) => `${data.memberName} joined "${data.groupName}"`,
    channelId: 'groups',
  },

  // Expense notifications
  EXPENSE_ADDED: {
    title: '📝 New Expense',
    getBody: (data) => `${data.paidByName} added "${data.description}" (${data.currency}${data.amount}) in "${data.groupName}"`,
    channelId: 'expenses',
  },
  EXPENSE_UPDATED: {
    title: '📝 Expense Updated',
    getBody: (data) => `"${data.description}" was updated in "${data.groupName}"`,
    channelId: 'expenses',
  },
  EXPENSE_DELETED: {
    title: '🗑️ Expense Deleted',
    getBody: (data) => `"${data.description}" was deleted from "${data.groupName}"`,
    channelId: 'expenses',
  },
};

class NotificationService {
  /**
   * Get FCM tokens for a list of user IDs
   * @param {string[]} userIds - Array of user IDs
   * @returns {Promise<{userId: string, token: string}[]>} - Array of user IDs with their tokens
   */
  static async getTokensForUsers(userIds) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
      const result = await query(
        `SELECT id, fcm_token FROM users
         WHERE id IN (${placeholders})
         AND fcm_token IS NOT NULL
         AND deleted_at IS NULL`,
        userIds
      );

      return result.rows.map(row => ({
        userId: row.id,
        token: row.fcm_token,
      }));
    } catch (error) {
      console.error('[NotificationService] Error getting tokens:', error);
      return [];
    }
  }

  /**
   * Get FCM tokens for all members of a group
   * @param {string} groupId - Group ID
   * @param {string[]} excludeUserIds - User IDs to exclude (e.g., the action initiator)
   * @returns {Promise<{userId: string, token: string}[]>}
   */
  static async getGroupMemberTokens(groupId, excludeUserIds = []) {
    try {
      let excludeClause = '';
      const params = [groupId];

      if (excludeUserIds.length > 0) {
        const excludePlaceholders = excludeUserIds.map((_, i) => `$${i + 2}`).join(', ');
        excludeClause = `AND gm.user_id NOT IN (${excludePlaceholders})`;
        params.push(...excludeUserIds);
      }

      const result = await query(
        `SELECT u.id, u.fcm_token
         FROM users u
         INNER JOIN group_members gm ON u.id = gm.user_id
         WHERE gm.group_id = $1
         AND gm.deleted_at IS NULL
         AND u.fcm_token IS NOT NULL
         AND u.deleted_at IS NULL
         ${excludeClause}`,
        params
      );

      return result.rows.map(row => ({
        userId: row.id,
        token: row.fcm_token,
      }));
    } catch (error) {
      console.error('[NotificationService] Error getting group member tokens:', error);
      return [];
    }
  }

  /**
   * Send notification to a single user
   * @param {string} userId - User ID to notify
   * @param {string} type - Notification type (from NOTIFICATION_TYPES)
   * @param {object} data - Data for notification body
   * @param {object} additionalData - Additional data to include in notification payload
   */
  static async sendToUser(userId, type, data, additionalData = {}) {
    const tokens = await this.getTokensForUsers([userId]);
    if (tokens.length === 0) {
      console.log(`[NotificationService] No FCM token for user ${userId}`);
      return { success: false, reason: 'no_token' };
    }

    return this.sendNotification(tokens[0].token, type, data, additionalData);
  }

  /**
   * Send notification to multiple users
   * @param {string[]} userIds - User IDs to notify
   * @param {string} type - Notification type
   * @param {object} data - Data for notification body
   * @param {object} additionalData - Additional data to include in notification payload
   */
  static async sendToUsers(userIds, type, data, additionalData = {}) {
    const tokens = await this.getTokensForUsers(userIds);
    if (tokens.length === 0) {
      console.log('[NotificationService] No FCM tokens found for users');
      return { success: false, reason: 'no_tokens' };
    }

    const results = await Promise.all(
      tokens.map(({ token }) => this.sendNotification(token, type, data, additionalData))
    );

    return {
      success: true,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };
  }

  /**
   * Send notification to all group members
   * @param {string} groupId - Group ID
   * @param {string} type - Notification type
   * @param {object} data - Data for notification body
   * @param {string[]} excludeUserIds - Users to exclude
   * @param {object} additionalData - Additional data to include in notification payload
   */
  static async sendToGroup(groupId, type, data, excludeUserIds = [], additionalData = {}) {
    const tokens = await this.getGroupMemberTokens(groupId, excludeUserIds);
    if (tokens.length === 0) {
      console.log(`[NotificationService] No FCM tokens for group ${groupId}`);
      return { success: false, reason: 'no_tokens' };
    }

    const results = await Promise.all(
      tokens.map(({ token }) => this.sendNotification(token, type, data, additionalData))
    );

    return {
      success: true,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };
  }

  /**
   * Send FCM notification
   * @param {string} token - FCM token
   * @param {string} type - Notification type
   * @param {object} data - Data for notification body
   * @param {object} additionalData - Additional data payload
   */
  static async sendNotification(token, type, data, additionalData = {}) {
    try {
      // Get notification config
      const config = NOTIFICATION_TYPES[type];
      if (!config) {
        console.error(`[NotificationService] Unknown notification type: ${type}`);
        return { success: false, reason: 'unknown_type' };
      }

      // Build notification message
      const message = {
        token,
        notification: {
          title: config.title,
          body: config.getBody(data),
        },
        data: {
          type,
          ...additionalData,
          // Convert all values to strings for FCM
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
        },
        android: {
          notification: {
            channelId: config.channelId,
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      // Send via Firebase Admin
      const response = await admin.messaging().send(message);
      console.log(`[NotificationService] Sent ${type} notification:`, response);

      return { success: true, messageId: response };
    } catch (error) {
      console.error(`[NotificationService] Error sending notification:`, error);

      // Handle invalid tokens
      if (error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-registration-token') {
        // Token is invalid, should be removed from database
        await this.invalidateToken(token);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Invalidate/remove an invalid FCM token
   * @param {string} token - The invalid token to remove
   */
  static async invalidateToken(token) {
    try {
      await query(
        `UPDATE users SET fcm_token = NULL, fcm_token_updated_at = NOW()
         WHERE fcm_token = $1`,
        [token]
      );
      console.log('[NotificationService] Invalidated token');
    } catch (error) {
      console.error('[NotificationService] Error invalidating token:', error);
    }
  }

  /**
   * Update FCM token for a user
   * @param {string} userId - User ID
   * @param {string} token - New FCM token
   */
  static async updateUserToken(userId, token) {
    try {
      await query(
        `UPDATE users SET fcm_token = $2, fcm_token_updated_at = NOW()
         WHERE id = $1`,
        [userId, token]
      );
      console.log(`[NotificationService] Updated FCM token for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('[NotificationService] Error updating token:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================
  // Convenience Methods
  // =====================

  /**
   * Notify group members about a new settlement
   */
  static async notifySettlementCreated(groupId, settlement, fromUserName, toUserName, excludeUserId) {
    const currencySymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    const currency = currencySymbols[settlement.currency] || settlement.currency;

    return this.sendToGroup(groupId, 'SETTLEMENT_CREATED', {
      fromUserName,
      toUserName,
      amount: settlement.amount,
      currency,
      groupId,
    }, [excludeUserId], { groupId, settlementId: settlement.id });
  }

  /**
   * Notify group members about a confirmed settlement
   */
  static async notifySettlementConfirmed(groupId, settlement, fromUserName, toUserName, excludeUserId) {
    const currencySymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    const currency = currencySymbols[settlement.currency] || settlement.currency;

    return this.sendToGroup(groupId, 'SETTLEMENT_CONFIRMED', {
      fromUserName,
      toUserName,
      amount: settlement.amount,
      currency,
      groupId,
    }, [excludeUserId], { groupId, settlementId: settlement.id });
  }

  /**
   * Notify group members about group being archived/completed
   */
  static async notifyGroupArchived(groupId, groupName, excludeUserId) {
    return this.sendToGroup(groupId, 'GROUP_ARCHIVED', {
      groupName,
      groupId,
    }, [excludeUserId], { groupId });
  }

  /**
   * Notify group members about group being completed/closed
   */
  static async notifyGroupCompleted(groupId, groupName, excludeUserId) {
    return this.sendToGroup(groupId, 'GROUP_COMPLETED', {
      groupName,
      groupId,
    }, [excludeUserId], { groupId });
  }

  /**
   * Notify a removed member and group members
   */
  static async notifyMemberRemoved(groupId, groupName, removedUserId, removedUserName, removedByUserId) {
    // Notify the removed user
    await this.sendToUser(removedUserId, 'MEMBER_REMOVED', {
      memberName: 'You',
      groupName,
      groupId,
    }, { groupId });

    // Notify other group members
    return this.sendToGroup(groupId, 'MEMBER_REMOVED', {
      memberName: removedUserName,
      groupName,
      groupId,
    }, [removedUserId, removedByUserId], { groupId });
  }

  /**
   * Notify group members when someone leaves
   */
  static async notifyMemberLeft(groupId, groupName, leftUserId, leftUserName) {
    return this.sendToGroup(groupId, 'MEMBER_LEFT', {
      memberName: leftUserName,
      groupName,
      groupId,
    }, [leftUserId], { groupId });
  }

  /**
   * Notify group members about a new member
   */
  static async notifyMemberAdded(groupId, groupName, newMemberName, addedByUserId) {
    return this.sendToGroup(groupId, 'MEMBER_ADDED', {
      memberName: newMemberName,
      groupName,
      groupId,
    }, [addedByUserId], { groupId });
  }
}

module.exports = { NotificationService, NOTIFICATION_TYPES };
