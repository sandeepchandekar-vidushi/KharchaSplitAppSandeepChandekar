const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const personalExpenseController = require('../controllers/personalExpenseController');

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

module.exports = router;
