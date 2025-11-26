import { query } from '../config/database.js';
import crypto from 'crypto';

/**
 * Generate a unique invite code
 */
function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Create invites for phone numbers
 * POST /api/v1/invites/create
 */
const createInvite = async (req, res, next) => {
  try {
    const { phoneNumbers, context } = req.body;
    const userId = req.user.id;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Phone numbers array is required',
      });
    }

    const invites = [];

    for (const phoneNumber of phoneNumbers) {
      try {
        // Generate unique invite code
        const inviteCode = generateInviteCode();

        // Set expiration (30 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Create invite record
        const result = await query(
          `INSERT INTO invites (invite_code, invited_by, phone_number, context, expires_at, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, invite_code, phone_number, created_at`,
          [inviteCode, userId, phoneNumber, JSON.stringify(context || {}), expiresAt, 'pending']
        );

        const invite = result.rows[0];

        // Generate share URL and message
        const shareUrl = `https://kharchasplit.com/invite/${inviteCode}`;
        const shareMessage = context?.groupName
          ? `Join me on KharchaSplit! I've added you to "${context.groupName}". Use my invite code: ${inviteCode}\n\nDownload: ${shareUrl}`
          : `Join me on KharchaSplit! Use my invite code: ${inviteCode}\n\nDownload: ${shareUrl}`;

        invites.push({
          phoneNumber: invite.phone_number,
          inviteCode: invite.invite_code,
          shareUrl,
          shareMessage,
        });
      } catch (error) {
        console.error(`Error creating invite for ${phoneNumber}:`, error);
        // Continue with other invites
      }
    }

    res.json({
      success: true,
      data: {
        invites,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check invite status by invite code
 * GET /api/v1/invites/status?inviteCode=XXX
 */
const checkInviteStatus = async (req, res, next) => {
  try {
    const { inviteCode } = req.query;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        error: 'Invite code is required',
      });
    }

    const result = await query(
      `SELECT i.*, u.name as inviter_name, u.phone_number as inviter_phone
       FROM invites i
       JOIN users u ON i.invited_by = u.id
       WHERE i.invite_code = $1 AND i.deleted_at IS NULL`,
      [inviteCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invite not found',
      });
    }

    const invite = result.rows[0];

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    const status = invite.status === 'accepted' ? 'accepted' :
                   now > expiresAt ? 'expired' : 'pending';

    res.json({
      success: true,
      data: {
        inviteCode: invite.invite_code,
        status,
        phoneNumber: invite.phone_number,
        invitedBy: {
          userId: invite.invited_by,
          name: invite.inviter_name,
        },
        invitedAt: invite.created_at,
        acceptedAt: invite.accepted_at,
        expiresAt: invite.expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept an invite
 * POST /api/v1/invites/accept
 */
const acceptInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        error: 'Invite code is required',
      });
    }

    // Get invite
    const inviteResult = await query(
      'SELECT * FROM invites WHERE invite_code = $1 AND deleted_at IS NULL',
      [inviteCode]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invite not found',
      });
    }

    const invite = inviteResult.rows[0];

    // Check if already accepted
    if (invite.status === 'accepted') {
      return res.status(400).json({
        success: false,
        error: 'Invite already accepted',
      });
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'Invite has expired',
      });
    }

    // Mark invite as accepted
    await query(
      `UPDATE invites
       SET status = 'accepted', accepted_at = NOW(), accepted_by = $1
       WHERE invite_code = $2`,
      [userId, inviteCode]
    );

    res.json({
      success: true,
      message: 'Invite accepted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my invites
 * GET /api/v1/invites/my-invites
 */
const getMyInvites = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT id, phone_number, status, created_at as invited_at,
              accepted_at, invite_code, expires_at
       FROM invites
       WHERE invited_by = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    const invites = result.rows.map(invite => {
      const now = new Date();
      const expiresAt = new Date(invite.expires_at);
      const status = invite.status === 'accepted' ? 'accepted' :
                     now > expiresAt ? 'expired' : 'pending';

      return {
        id: invite.id,
        phoneNumber: invite.phone_number,
        status,
        invitedAt: invite.invited_at,
        acceptedAt: invite.accepted_at,
        inviteCode: invite.invite_code,
      };
    });

    const totalInvites = invites.length;
    const acceptedInvites = invites.filter(i => i.status === 'accepted').length;
    const pendingInvites = invites.filter(i => i.status === 'pending').length;
    const expiredInvites = invites.filter(i => i.status === 'expired').length;

    res.json({
      success: true,
      data: {
        totalInvites,
        acceptedInvites,
        pendingInvites,
        expiredInvites,
        invites,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend an invite
 * POST /api/v1/invites/resend
 */
const resendInvite = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user.id;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Find existing invite
    const result = await query(
      `SELECT * FROM invites
       WHERE invited_by = $1 AND phone_number = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, phoneNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No invite found for this phone number',
      });
    }

    const invite = result.rows[0];
    const inviteCode = invite.invite_code;
    const context = invite.context ? JSON.parse(invite.context) : {};

    // Generate share URL and message
    const shareUrl = `https://kharchasplit.com/invite/${inviteCode}`;
    const shareMessage = context?.groupName
      ? `Join me on KharchaSplit! I've added you to "${context.groupName}". Use my invite code: ${inviteCode}\n\nDownload: ${shareUrl}`
      : `Join me on KharchaSplit! Use my invite code: ${inviteCode}\n\nDownload: ${shareUrl}`;

    res.json({
      success: true,
      data: {
        phoneNumber,
        inviteCode,
        shareUrl,
        shareMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an invite
 * POST /api/v1/invites/cancel
 */
const cancelInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        error: 'Invite code is required',
      });
    }

    // Check if invite exists and belongs to user
    const result = await query(
      'SELECT * FROM invites WHERE invite_code = $1 AND invited_by = $2 AND deleted_at IS NULL',
      [inviteCode, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invite not found or you do not have permission',
      });
    }

    // Soft delete the invite
    await query(
      'UPDATE invites SET deleted_at = NOW() WHERE invite_code = $1',
      [inviteCode]
    );

    res.json({
      success: true,
      message: 'Invite cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createInvite,
  checkInviteStatus,
  acceptInvite,
  getMyInvites,
  resendInvite,
  cancelInvite,
};
