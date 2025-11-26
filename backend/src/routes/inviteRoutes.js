import express from 'express';
import { authenticate } from '../middleware/auth.js';
import inviteController from '../controllers/inviteController.js';

const router = express.Router();

// All invite routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/invites/create
 * Create invites for phone numbers
 */
router.post('/create', inviteController.createInvite);

/**
 * GET /api/v1/invites/status?inviteCode=XXX
 * Check invite status
 */
router.get('/status', inviteController.checkInviteStatus);

/**
 * POST /api/v1/invites/accept
 * Accept an invite
 */
router.post('/accept', inviteController.acceptInvite);

/**
 * GET /api/v1/invites/my-invites
 * Get my invites
 */
router.get('/my-invites', inviteController.getMyInvites);

/**
 * POST /api/v1/invites/resend
 * Resend an invite
 */
router.post('/resend', inviteController.resendInvite);

/**
 * POST /api/v1/invites/cancel
 * Cancel an invite
 */
router.post('/cancel', inviteController.cancelInvite);

export default router;
