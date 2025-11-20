const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const groupController = require('../controllers/groupController');

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

module.exports = router;
