import express from 'express';
import { body  } from 'express-validator';
import { authenticate  } from '../middleware/auth.js';
import { validate  } from '../middleware/validation.js';
import personalExpenseController from '../controllers/personalExpenseController.js';

const router = express.Router();

router.get('/', authenticate, personalExpenseController.getPersonalExpenses);
router.get('/:id', authenticate, personalExpenseController.getPersonalExpense);

router.post(
  '/',
  authenticate,
  [
    body('description').trim().isLength({ min: 1, max: 500 }),
    body('amount').isFloat({ min: 0 })
  ],
  validate,
  personalExpenseController.createPersonalExpense
);

router.put('/:id', authenticate, personalExpenseController.updatePersonalExpense);
router.delete('/:id', authenticate, personalExpenseController.deletePersonalExpense);

export default router;
