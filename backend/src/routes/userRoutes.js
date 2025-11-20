const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const userController = require('../controllers/userController');

const router = express.Router();

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

module.exports = router;
