import express from 'express';
import { body  } from 'express-validator';
import { authenticate  } from '../middleware/auth.js';
import { validate  } from '../middleware/validation.js';
import activityController from '../controllers/activityController.js';

const router = express.Router();

// Create activity
router.post(
  '/',
  authenticate,
  [
    body('userId').notEmpty().withMessage('userId is required'),
    body('activityType').notEmpty().withMessage('activityType is required'),
    body('entityType').notEmpty().withMessage('entityType is required'),
    body('entityId').notEmpty().withMessage('entityId is required'),
    body('title').notEmpty().withMessage('title is required'),
  ],
  validate,
  activityController.createActivity
);

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

export default router;
