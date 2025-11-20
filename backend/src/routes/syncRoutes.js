const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const syncController = require('../controllers/syncController');

const router = express.Router();

router.post(
  '/',
  authenticate,
  [body('operations').isArray().notEmpty()],
  validate,
  syncController.syncData
);

router.get('/last', authenticate, syncController.getLastSyncTime);

module.exports = router;
