import Activity from '../models/Activity.js';

/**
 * Get activities for a user
 * GET /api/v1/activities?userId=:id&page=1&limit=50
 */
const getUserActivities = async (req, res, next) => {
  try {
    const { userId, page = 1, limit = 50 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query parameter is required',
      });
    }

    // Users can only view their own activities
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own activities',
      });
    }

    const offset = (page - 1) * limit;
    const activitiesRaw = await Activity.findByUserId(userId, parseInt(limit), offset);
    const total = await Activity.countByUserId(userId);
    const unreadCount = await Activity.getUnreadCount(userId);

    // Transform snake_case to camelCase for frontend
    const activities = activitiesRaw.map(act => ({
      id: act.id,
      userId: act.user_id,
      groupId: act.group_id,
      activityType: act.activity_type,
      entityType: act.entity_type,
      entityId: act.entity_id,
      title: act.title,
      description: act.description,
      metadata: act.metadata,
      isRead: act.is_read,
      createdAt: act.created_at,
      actorName: act.actor_name,
      groupName: act.group_name,
    }));

    res.json({
      success: true,
      data: activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: offset + activities.length < total,
      },
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get activities for a group
 * GET /api/v1/activities/group/:groupId?page=1&limit=50
 */
const getGroupActivities = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // TODO: Verify user is member of the group
    // For now, any authenticated user can view group activities

    const offset = (page - 1) * limit;
    const activities = await Activity.findByGroupId(groupId, parseInt(limit), offset);
    const total = await Activity.countByGroupId(groupId);

    res.json({
      success: true,
      data: activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: offset + activities.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single activity
 * GET /api/v1/activities/:id
 */
const getActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    // Users can only view their own activities
    if (activity.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own activities',
      });
    }

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread count
 * GET /api/v1/activities/unread/count?userId=:id
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId query parameter is required',
      });
    }

    // Users can only view their own unread count
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own unread count',
      });
    }

    const count = await Activity.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark activity as read
 * PATCH /api/v1/activities/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const activity = await Activity.markAsRead(id, req.user.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    res.json({
      success: true,
      message: 'Activity marked as read',
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all activities as read
 * PATCH /api/v1/activities/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    // Users can only mark their own activities as read
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only mark your own activities as read',
      });
    }

    await Activity.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All activities marked as read',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark group activities as read
 * PATCH /api/v1/activities/group/:groupId/read-all
 */
const markGroupActivitiesAsRead = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    // TODO: Verify user is member of the group

    await Activity.markGroupActivitiesAsRead(groupId, req.user.id);

    res.json({
      success: true,
      message: 'Group activities marked as read',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new activity
 * POST /api/v1/activities
 */
const createActivity = async (req, res, next) => {
  try {
    const {
      userId,
      activityType,
      entityType,
      entityId,
      title,
      description,
      metadata,
      groupId,
    } = req.body;

    // Validate required fields
    if (!userId || !activityType || !entityType || !entityId || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, activityType, entityType, entityId, title',
      });
    }

    // Users can only create activities for themselves
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only create activities for yourself',
      });
    }

    const activity = await Activity.create({
      userId,
      activityType,
      entityType,
      entityId,
      title,
      description,
      metadata,
      groupId,
    });

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data: {
        id: activity.id,
        userId: activity.user_id,
        groupId: activity.group_id,
        activityType: activity.activity_type,
        entityType: activity.entity_type,
        entityId: activity.entity_id,
        title: activity.title,
        description: activity.description,
        metadata: activity.metadata,
        isRead: activity.is_read,
        createdAt: activity.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete activity
 * DELETE /api/v1/activities/:id
 */
const deleteActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get activity to verify ownership
    const existingActivity = await Activity.findById(id);

    if (!existingActivity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    // Users can only delete their own activities
    if (existingActivity.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own activities',
      });
    }

    const deleted = await Activity.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found',
      });
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getUserActivities,
  getGroupActivities,
  getActivity,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  markGroupActivitiesAsRead,
  createActivity,
  deleteActivity,
};
