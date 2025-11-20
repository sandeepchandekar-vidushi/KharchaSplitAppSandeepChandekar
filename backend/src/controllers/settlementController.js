const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const User = require('../models/User');
const GroupService = require('../services/groupService');
const ActivityService = require('../services/activityService');

/**
 * Get settlements for a group
 * GET /api/v1/settlements?groupId=:id
 */
const getSettlements = async (req, res, next) => {
  try {
    const { groupId } = req.query;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: 'groupId query parameter is required',
      });
    }

    // Verify user has access
    await GroupService.validateGroupAccess(groupId, req.user.id);

    const settlements = await Settlement.findByGroupId(groupId);

    res.json({
      success: true,
      data: settlements,
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
 * Create new settlement
 * POST /api/v1/settlements
 */
const createSettlement = async (req, res, next) => {
  try {
    const { groupId, fromUserId, toUserId, amount, currency, notes } = req.body;

    // Verify user has access
    await GroupService.validateGroupAccess(groupId, req.user.id);

    // Verify the user creating the settlement is the payer
    if (fromUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only create settlements for yourself',
      });
    }

    // Get group and user names for activity log
    const group = await Group.findById(groupId);
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    const settlement = await Settlement.create({
      groupId,
      fromUserId,
      toUserId,
      amount,
      currency,
      notes,
    });

    // Log activity
    await ActivityService.logSettlementCreated(
      settlement.id,
      groupId,
      fromUserId,
      toUserId,
      group.name,
      fromUser.name,
      toUser.name,
      amount,
      currency || 'USD'
    );

    res.status(201).json({
      success: true,
      message: 'Settlement created successfully',
      data: settlement,
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
 * Confirm settlement (2-way confirmation)
 * PATCH /api/v1/settlements/:id/confirm
 */
const confirmSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get settlement details
    const existingSettlement = await Settlement.findById(id);

    if (!existingSettlement) {
      return res.status(404).json({
        success: false,
        error: 'Settlement not found',
      });
    }

    // Verify user is the receiver
    if (existingSettlement.to_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only the receiver can confirm this settlement',
      });
    }

    // Get group and user names for activity log
    const group = await Group.findById(existingSettlement.group_id);
    const fromUser = await User.findById(existingSettlement.from_user_id);
    const toUser = await User.findById(existingSettlement.to_user_id);

    const settlement = await Settlement.confirm(id);

    if (!settlement) {
      return res.status(400).json({
        success: false,
        error: 'Settlement already confirmed or not found',
      });
    }

    // Log activity
    await ActivityService.logSettlementConfirmed(
      id,
      existingSettlement.group_id,
      existingSettlement.from_user_id,
      existingSettlement.to_user_id,
      group.name,
      fromUser.name,
      toUser.name,
      existingSettlement.amount,
      existingSettlement.currency
    );

    res.json({
      success: true,
      message: 'Settlement confirmed successfully',
      data: settlement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete settlement
 * DELETE /api/v1/settlements/:id
 */
const deleteSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get settlement to verify access
    const settlement = await Settlement.findById(id);

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'Settlement not found',
      });
    }

    // Only the payer or group admin can delete
    const isAdmin = await require('../models/Group').isAdmin(settlement.group_id, req.user.id);
    const isPayer = settlement.from_user_id === req.user.id;

    if (!isAdmin && !isPayer) {
      return res.status(403).json({
        success: false,
        error: 'Only group admins or the payer can delete this settlement',
      });
    }

    const deleted = await Settlement.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Settlement not found',
      });
    }

    res.json({
      success: true,
      message: 'Settlement deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettlements,
  createSettlement,
  confirmSettlement,
  deleteSettlement,
};
