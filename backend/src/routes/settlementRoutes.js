const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const settlementController = require('../controllers/settlementController');

const router = express.Router();

router.get('/', authenticate, settlementController.getSettlements);

router.post(
  '/',
  authenticate,
  [
    body('groupId').notEmpty(),
    body('fromUserId').notEmpty(),
    body('toUserId').notEmpty(),
    body('amount').isFloat({ min: 0 })
  ],
  validate,
  settlementController.createSettlement
);

router.patch('/:id/confirm', authenticate, settlementController.confirmSettlement);
router.delete('/:id', authenticate, settlementController.deleteSettlement);

module.exports = router;
