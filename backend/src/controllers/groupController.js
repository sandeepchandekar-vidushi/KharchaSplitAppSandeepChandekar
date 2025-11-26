import Group from '../models/Group.js';
import GroupService from '../services/groupService.js';
import ActivityService from '../services/activityService.js';
import { NotificationService } from '../services/notificationService.js';

/**
 * Get user's groups
 * GET /api/v1/groups?userId=:id&page=1&limit=20
 */
const getGroups = async (req, res, next) => {
  try {
    const { userId, page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query parameter is required',
      });
    }

    const offset = (page - 1) * limit;
    const groups = await Group.findByUserId(userId, parseInt(limit), offset);

    // Fetch members for each group
    const groupsWithMembers = await Promise.all(
      groups.map(async (group) => {
        const members = await Group.getMembers(group.id);

        // Transform members to camelCase format for frontend compatibility
        const transformedMembers = members.map(member => ({
          userId: member.user_id,
          name: member.name,
          phoneNumber: member.phone_number,
          email: member.email,
          role: member.role,
          profileImage: member.profile_image_base64,
          joinedAt: member.joined_at,
          addedBy: member.added_by,
        }));

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          coverImageBase64: group.cover_image_base64,
          currency: group.currency,
          createdBy: group.created_by,
          createdAt: group.created_at,
          updatedAt: group.updated_at,
          archivedAt: group.archived_at,
          isArchived: !!group.archived_at,
          memberCount: parseInt(group.member_count) || 0,
          expenseCount: parseInt(group.expense_count) || 0,
          totalExpenses: parseFloat(group.total_expenses) || 0,
          members: transformedMembers,
        };
      })
    );

    res.json({
      success: true,
      data: groupsWithMembers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: groups.length === parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single group with details
 * GET /api/v1/groups/:id
 */
const getGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user has access
    await GroupService.validateGroupAccess(id, req.user.id);

    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    // Get members
    const members = await Group.getMembers(id);

    // Transform members to camelCase format for frontend compatibility
    const transformedMembers = members.map(member => ({
      userId: member.user_id,
      name: member.name,
      phoneNumber: member.phone_number,
      email: member.email,
      role: member.role,
      profileImage: member.profile_image_base64,
      joinedAt: member.joined_at,
      addedBy: member.added_by,
    }));

    // Get balances
    const balances = await GroupService.calculateBalances(id);

    res.json({
      success: true,
      data: {
        id: group.id,
        name: group.name,
        description: group.description,
        currency: group.currency,
        createdBy: group.created_by,
        coverImageBase64: group.cover_image_base64,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        archivedAt: group.archived_at,
        isArchived: !!group.archived_at,
        memberCount: parseInt(group.member_count) || 0,
        expenseCount: parseInt(group.expense_count) || 0,
        totalExpenses: parseFloat(group.total_expenses) || 0,
        members: transformedMembers,
        balances,
      },
    });
  } catch (error) {
    if (error.message === 'User is not a member of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Create new group
 * POST /api/v1/groups
 */
const createGroup = async (req, res, next) => {
  try {
    const { name, description, coverImageBase64, currency, members } = req.body;

    const group = await Group.create(
      {
        name,
        description,
        coverImageBase64,
        currency,
        createdBy: req.user.id,
      },
      members
    );

    // Log activity
    await ActivityService.logGroupCreated(group.id, req.user.id, name);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update group
 * PUT /api/v1/groups/:id
 */
const updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, coverImageBase64, currency } = req.body;

    // Verify user is admin
    await GroupService.validateAdminAccess(id, req.user.id);

    const group = await Group.update(id, {
      name,
      description,
      coverImageBase64,
      currency,
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    // Log activity
    const changes = { name, description };
    await ActivityService.logGroupUpdated(id, req.user.id, group.name, changes);

    res.json({
      success: true,
      message: 'Group updated successfully',
      data: group,
    });
  } catch (error) {
    if (error.message === 'User is not an admin of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Delete group
 * DELETE /api/v1/groups/:id
 */
const deleteGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user is admin
    await GroupService.validateAdminAccess(id, req.user.id);

    // Get group details before deletion for activity log
    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    const deleted = await Group.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    // Log activity
    await ActivityService.logGroupDeleted(id, req.user.id, group.name);

    res.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    if (error.message === 'User is not an admin of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Get group members
 * GET /api/v1/groups/:id/members
 */
const getGroupMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user has access
    await GroupService.validateGroupAccess(id, req.user.id);

    const members = await Group.getMembers(id);

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    if (error.message === 'User is not a member of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Add member to group
 * POST /api/v1/groups/:id/members
 */
const addGroupMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, name, phoneNumber, email } = req.body;

    // Verify user is member (members can invite others)
    await GroupService.validateGroupAccess(id, req.user.id);

    // Get group name for activity log
    const group = await Group.findById(id);

    const member = await Group.addMember(id, {
      userId,
      name,
      phoneNumber,
      email,
      addedBy: req.user.id,
    });

    // Log activity
    await ActivityService.logMemberAdded(id, req.user.id, group.name, name);

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: member,
    });
  } catch (error) {
    if (error.message === 'User is not a member of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Remove member from group
 * DELETE /api/v1/groups/:id/members/:userId
 */
const removeGroupMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    // Allow users to remove themselves (leave group) without being admin
    // For removing others, require admin access
    const isRemovingSelf = req.user.id === userId;

    if (!isRemovingSelf) {
      // Verify user is admin to remove others
      await GroupService.validateAdminAccess(id, req.user.id);
    } else {
      // For leaving, just verify user is a member
      await GroupService.validateGroupAccess(id, req.user.id);
    }

    // Get group and member info for activity log
    const group = await Group.findById(id);
    const members = await Group.getMembers(id);
    const member = members.find(m => m.user_id === userId);

    const removed = await Group.removeMember(id, userId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    // Log activity
    if (member) {
      await ActivityService.logMemberRemoved(id, req.user.id, group.name, member.name);
    }

    // Send push notification
    try {
      if (isRemovingSelf) {
        // User left the group - notify other members
        await NotificationService.notifyMemberLeft(id, group.name, userId, member?.name || 'A member');
      } else {
        // User was removed - notify the removed user and other members
        await NotificationService.notifyMemberRemoved(id, group.name, userId, member?.name || 'A member', req.user.id);
      }
    } catch (notifError) {
      console.error('[GroupController] Error sending member removal notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: isRemovingSelf ? 'Successfully left the group' : 'Member removed successfully',
    });
  } catch (error) {
    if (error.message === 'User is not an admin of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    if (error.message === 'User is not a member of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Update member role
 * PUT /api/v1/groups/:id/members/:userId
 */
const updateMemberRole = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    // Verify user is admin
    await GroupService.validateAdminAccess(id, req.user.id);

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be "admin" or "member"',
      });
    }

    const member = await Group.updateMemberRole(id, userId, role);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: member,
    });
  } catch (error) {
    if (error.message === 'User is not an admin of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Archive group
 * PUT /api/v1/groups/:id/archive
 */
const archiveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user is admin
    await GroupService.validateAdminAccess(id, req.user.id);

    // Get group details before archiving for activity log
    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    const archived = await Group.archive(id);

    if (!archived) {
      return res.status(404).json({
        success: false,
        error: 'Group not found or already archived',
      });
    }

    // Log activity
    await ActivityService.logGroupArchived(id, req.user.id, group.name);

    // Send push notification to group members
    try {
      await NotificationService.notifyGroupArchived(id, group.name, req.user.id);
    } catch (notifError) {
      console.error('[GroupController] Error sending archive notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Group archived successfully',
    });
  } catch (error) {
    if (error.message === 'User is not an admin of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Unarchive group
 * PUT /api/v1/groups/:id/unarchive
 */
const unarchiveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user is admin
    await GroupService.validateAdminAccess(id, req.user.id);

    const unarchived = await Group.unarchive(id);

    if (!unarchived) {
      return res.status(404).json({
        success: false,
        error: 'Group not found or not archived',
      });
    }

    res.json({
      success: true,
      message: 'Group unarchived successfully',
    });
  } catch (error) {
    if (error.message === 'User is not an admin of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * Complete group (archive with completion status)
 * PUT /api/v1/groups/:id/complete
 */
const completeGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user is admin
    await GroupService.validateAdminAccess(id, req.user.id);

    // Get group details before completing for activity log
    const group = await Group.findById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    const completed = await Group.archive(id);

    if (!completed) {
      return res.status(404).json({
        success: false,
        error: 'Group not found or already completed',
      });
    }

    // Log activity
    await ActivityService.logGroupArchived(id, req.user.id, group.name);

    // Send push notification to group members
    try {
      await NotificationService.notifyGroupCompleted(id, group.name, req.user.id);
    } catch (notifError) {
      console.error('[GroupController] Error sending complete notification:', notifError);
    }

    res.json({
      success: true,
      message: 'Group completed successfully',
    });
  } catch (error) {
    if (error.message === 'User is not an admin of this group') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

export default {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  updateMemberRole,
  archiveGroup,
  unarchiveGroup,
  completeGroup,
};
