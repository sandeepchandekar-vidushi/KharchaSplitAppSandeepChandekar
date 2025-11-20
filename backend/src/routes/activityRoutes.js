const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const activityController = require('../controllers/activityController');

const router = express.Router();

// Get user activities
router.get('/', authenticate, activityController.getUserActivities);

// Get group activities
router.get('/group/:groupId', authenticate, activityController.getGroupActivities);

// Get unread count
router.get('/unread/count', authenticate, activityController.getUnreadCount);

// Get single activity
router.get('/:id', authenticate, activityController.getActivity);

// Mark activity as read
router.patch('/:id/read', authenticate, activityController.markAsRead);

// Mark all activities as read
router.patch(
  '/read-all',
  authenticate,
  [body('userId').notEmpty()],
  validate,
  activityController.markAllAsRead
);

// Mark group activities as read
router.patch('/group/:groupId/read-all', authenticate, activityController.markGroupActivitiesAsRead);

// Delete activity
router.delete('/:id', authenticate, activityController.deleteActivity);

module.exports = router;
