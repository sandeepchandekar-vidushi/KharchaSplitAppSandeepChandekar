import express from 'express';
import { body  } from 'express-validator';
import { authenticate  } from '../middleware/auth.js';
import { validate  } from '../middleware/validation.js';
import groupController from '../controllers/groupController.js';

const router = express.Router();

router.get('/', authenticate, groupController.getGroups);
router.get('/:id', authenticate, groupController.getGroup);

router.post(
  '/',
  authenticate,
  [body('name').trim().isLength({ min: 2, max: 255 })],
  validate,
  groupController.createGroup
);

router.put('/:id', authenticate, groupController.updateGroup);
router.delete('/:id', authenticate, groupController.deleteGroup);

router.get('/:id/members', authenticate, groupController.getGroupMembers);

router.post(
  '/:id/members',
  authenticate,
  [
    body('userId').notEmpty(),
    body('name').trim().isLength({ min: 2, max: 255 })
  ],
  validate,
  groupController.addGroupMember
);

router.delete('/:id/members/:userId', authenticate, groupController.removeGroupMember);

router.put(
  '/:id/members/:userId',
  authenticate,
  [body('role').isIn(['admin', 'member'])],
  validate,
  groupController.updateMemberRole
);

// Archive/Unarchive routes
router.put('/:id/archive', authenticate, groupController.archiveGroup);
router.put('/:id/unarchive', authenticate, groupController.unarchiveGroup);
router.put('/:id/complete', authenticate, groupController.completeGroup);

export default router;
