import express from 'express';
import { body  } from 'express-validator';
import { authenticate  } from '../middleware/auth.js';
import { validate  } from '../middleware/validation.js';
import expenseController from '../controllers/expenseController.js';

const router = express.Router();

router.get('/', authenticate, expenseController.getExpenses);
router.get('/:id', authenticate, expenseController.getExpense);

router.post(
  '/',
  authenticate,
  [
    body('groupId').notEmpty(),
    body('description').trim().isLength({ min: 1, max: 500 }),
    body('amount').isFloat({ min: 0 }),
    body('paidById').notEmpty(),
    body('participants').isArray().notEmpty()
  ],
  validate,
  expenseController.createExpense
);

router.put('/:id', authenticate, expenseController.updateExpense);
router.delete('/:id', authenticate, expenseController.deleteExpense);

export default router;
