import express from 'express';
import { body  } from 'express-validator';
import { authenticate  } from '../middleware/auth.js';
import { validate  } from '../middleware/validation.js';
import userController from '../controllers/userController.js';

const router = express.Router();

// IMPORTANT: Specific routes must come BEFORE parameterized routes like /:id
router.post(
  '/check-registration',
  authenticate,
  [
    body('phoneNumbers').isArray({ min: 1 }).withMessage('Phone numbers array is required'),
  ],
  validate,
  userController.checkRegisteredUsers
);

router.get('/by-phone/:phoneNumber', authenticate, userController.getUserByPhone);

router.get('/:id', authenticate, userController.getUser);

router.put(
  '/:id',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 255 }),
    body('email').optional().isEmail(),
  ],
  validate,
  userController.updateUser
);

router.delete('/:id', authenticate, userController.deleteUser);

router.delete('/:id/deactivate', authenticate, userController.deactivateUser);

// FCM Token endpoints for push notifications
router.put(
  '/:id/fcm-token',
  authenticate,
  [
    body('fcmToken').notEmpty().withMessage('FCM token is required'),
  ],
  validate,
  userController.updateFcmToken
);

router.delete('/:id/fcm-token', authenticate, userController.removeFcmToken);

export default router;
