const Group = require('../models/Group');
const GroupService = require('../services/groupService');
const ActivityService = require('../services/activityService');

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

    res.json({
      success: true,
      data: groups,
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

    // Get balances
    const balances = await GroupService.calculateBalances(id);

    res.json({
      success: true,
      data: {
        ...group,
        members,
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

    const deleted = await Group.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

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

    // Verify user is admin
    await GroupService.validateAdminAccess(id, req.user.id);

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

    res.json({
      success: true,
      message: 'Member removed successfully',
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

module.exports = {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  updateMemberRole,
};
