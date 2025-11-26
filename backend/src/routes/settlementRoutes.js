import express from 'express';
import { body  } from 'express-validator';
import { authenticate  } from '../middleware/auth.js';
import { validate  } from '../middleware/validation.js';
import settlementController from '../controllers/settlementController.js';

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

export default router;
