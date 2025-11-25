/**
 * Group Repository
 * Data access layer for group-related operations
 */

import { sqliteService } from '../sqliteService';
import { apiService } from '../apiService';
import { syncService } from '../syncService';
import { GroupModel, GroupMemberModel, DbOperationResult } from '../../models';
import { v4 as uuidv4 } from 'react-native-uuid';

class GroupRepository {
  /**
   * Get all groups for a user
   */
  async getUserGroups(userId: string): Promise<GroupModel[]> {
    // Try to get from local database first
    const localGroups = await sqliteService.query<GroupModel>(
      `SELECT * FROM groups
       WHERE id IN (
         SELECT group_id FROM group_members WHERE user_id = ? AND deleted_at IS NULL
       )
       AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId]
    );

    return localGroups;
  }

  /**
   * Get a single group by ID
   */
  async getGroupById(groupId: string): Promise<GroupModel | null> {
    return sqliteService.findById<GroupModel>('groups', groupId);
  }

  /**
   * Create a new group
   */
  async createGroup(data: {
    name: string;
    description?: string;
    cover_image_base64?: string;
    currency: string; // Required - locked after creation
    created_by: string;
    members: Array<{ user_id: string; name: string; phone_number?: string; email?: string }>;
  }): Promise<DbOperationResult> {
    const groupId = uuidv4();
    const now = Date.now();

    const groupData: Partial<GroupModel> = {
      id: groupId,
      name: data.name,
      description: data.description,
      cover_image_base64: data.cover_image_base64,
      currency: data.currency || 'INR', // Default to INR if not provided
      created_by: data.created_by,
      created_at: now,
      updated_at: now,
      is_synced: 0,
    };

    try {
      // Insert group
      await sqliteService.insert('groups', groupData);

      // Add creator as admin member
      const creatorMember: Partial<GroupMemberModel> = {
        id: uuidv4(),
        group_id: groupId,
        user_id: data.created_by,
        name: '', // Will be filled from user data
        role: 'creator',
        joined_at: now,
        created_at: now,
        updated_at: now,
        is_synced: 0,
      };
      await sqliteService.insert('group_members', creatorMember);

      // Add other members
      for (const member of data.members) {
        const memberData: Partial<GroupMemberModel> = {
          id: uuidv4(),
          group_id: groupId,
          user_id: member.user_id,
          name: member.name,
          phone_number: member.phone_number,
          email: member.email,
          role: 'member',
          added_by: data.created_by,
          joined_at: now,
          created_at: now,
          updated_at: now,
          is_synced: 0,
        };
        await sqliteService.insert('group_members', memberData);
      }

      // Queue for sync
      await syncService.queueOperation('CREATE', 'groups', groupId, groupData, 1);

      return {
        success: true,
        insertId: groupId,
      };
    } catch (error: any) {
      console.error('[GroupRepository] Create group error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update group
   */
  async updateGroup(
    groupId: string,
    updates: Partial<Pick<GroupModel, 'name' | 'description' | 'cover_image_base64'>>
  ): Promise<DbOperationResult> {
    const updateData = {
      ...updates,
      updated_at: Date.now(),
      is_synced: 0,
    };

    const result = await sqliteService.update('groups', updateData, { id: groupId });

    if (result.success) {
      await syncService.queueOperation('UPDATE', 'groups', groupId, updateData);
    }

    return result;
  }

  /**
   * Delete group (soft delete)
   */
  async deleteGroup(groupId: string): Promise<DbOperationResult> {
    const result = await sqliteService.softDelete('groups', { id: groupId });

    if (result.success) {
      // Also soft delete all members
      await sqliteService.softDelete('group_members', { group_id: groupId });

      // Queue for sync
      await syncService.queueOperation('DELETE', 'groups', groupId, {});
    }

    return result;
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string): Promise<GroupMemberModel[]> {
    return sqliteService.select<GroupMemberModel>('group_members', {
      where: { group_id: groupId },
    });
  }

  /**
   * Add member to group
   */
  async addGroupMember(data: {
    group_id: string;
    user_id: string;
    name: string;
    phone_number?: string;
    email?: string;
    added_by: string;
  }): Promise<DbOperationResult> {
    const memberId = uuidv4();
    const now = Date.now();

    const memberData: Partial<GroupMemberModel> = {
      id: memberId,
      ...data,
      role: 'member',
      joined_at: now,
      created_at: now,
      updated_at: now,
      is_synced: 0,
    };

    const result = await sqliteService.insert('group_members', memberData);

    if (result.success) {
      await syncService.queueOperation('CREATE', 'group_members', memberId, memberData);
    }

    return result;
  }

  /**
   * Remove member from group
   */
  async removeGroupMember(groupId: string, userId: string): Promise<DbOperationResult> {
    const result = await sqliteService.softDelete('group_members', {
      group_id: groupId,
      user_id: userId,
    });

    if (result.success) {
      await syncService.queueOperation('DELETE', 'group_members', `${groupId}_${userId}`, {});
    }

    return result;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    groupId: string,
    userId: string,
    role: 'admin' | 'member'
  ): Promise<DbOperationResult> {
    return sqliteService.update(
      'group_members',
      { role, updated_at: Date.now(), is_synced: 0 },
      { group_id: groupId, user_id: userId }
    );
  }
}

// Export singleton instance
export const groupRepository = new GroupRepository();
export default groupRepository;
