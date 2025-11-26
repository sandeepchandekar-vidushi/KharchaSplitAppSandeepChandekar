import express from 'express';
import { body  } from 'express-validator';
import { authenticate  } from '../middleware/auth.js';
import { validate  } from '../middleware/validation.js';
import syncController from '../controllers/syncController.js';

const router = express.Router();

router.post(
  '/',
  authenticate,
  [body('operations').isArray().notEmpty()],
  validate,
  syncController.syncData
);

router.get('/last', authenticate, syncController.getLastSyncTime);

export default router;
