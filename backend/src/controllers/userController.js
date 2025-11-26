import User from '../models/User.js';
import { NotificationService } from '../services/notificationService.js';

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name,
        email: user.email,
        profileImage: user.profile_image_base64,
        preferredCurrency: user.preferred_currency,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/v1/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, profileImageBase64, preferredCurrency } = req.body;

    // Verify user owns this account
    if (req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own profile',
      });
    }

    const user = await User.update(id, {
      name,
      email,
      profileImageBase64,
      preferredCurrency,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name,
        email: user.email,
        profileImage: user.profile_image_base64,
        preferredCurrency: user.preferred_currency,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account
 * DELETE /api/v1/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user owns this account
    if (req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own account',
      });
    }

    const deleted = await User.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by phone number
 * GET /api/v1/users/by-phone/:phoneNumber
 */
const getUserByPhone = async (req, res, next) => {
  try {
    const { phoneNumber } = req.params;

    const user = await User.findByPhoneNumber(phoneNumber);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name,
        email: user.email,
        profileImage: user.profile_image_base64,
        preferredCurrency: user.preferred_currency,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if users are registered by phone numbers
 * POST /api/v1/users/check-registration
 *
 * Optimized: Uses a single database query with WHERE IN clause
 * instead of N sequential queries for better performance
 */
const checkRegisteredUsers = async (req, res, next) => {
  try {
    const { phoneNumbers } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Phone numbers array is required',
      });
    }

    // Use a single bulk query instead of N queries
    const users = await User.findByPhoneNumbers(phoneNumbers);

    const registered = users.map(user => ({
      phoneNumber: user.phone_number,
      userId: user.id,
      name: user.name,
      email: user.email,
      profileImage: user.profile_image_base64,
    }));

    // Find unregistered numbers
    const registeredPhoneSet = new Set(users.map(u => u.phone_number));
    const unregistered = phoneNumbers.filter(phone => !registeredPhoneSet.has(phone));

    res.json({
      success: true,
      data: {
        registered,
        unregistered,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate user account
 * DELETE /api/v1/users/:id/deactivate
 */
const deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user owns this account
    if (req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'You can only deactivate your own account',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Deactivate user (soft delete with is_active flag)
    const deactivated = await User.delete(id);

    if (!deactivated) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update FCM token for push notifications
 * PUT /api/v1/users/:id/fcm-token
 */
const updateFcmToken = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fcmToken } = req.body;

    // Verify user owns this account
    if (req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own FCM token',
      });
    }

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'FCM token is required',
      });
    }

    // Update the token
    const result = await NotificationService.updateUserToken(id, fcmToken);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update FCM token',
      });
    }

    res.json({
      success: true,
      message: 'FCM token updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove FCM token (logout/disable notifications)
 * DELETE /api/v1/users/:id/fcm-token
 */
const removeFcmToken = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify user owns this account
    if (req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'You can only remove your own FCM token',
      });
    }

    // Remove the token by setting it to null
    const result = await NotificationService.updateUserToken(id, null);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to remove FCM token',
      });
    }

    res.json({
      success: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getUser,
  getUserByPhone,
  updateUser,
  deleteUser,
  checkRegisteredUsers,
  deactivateUser,
  updateFcmToken,
  removeFcmToken,
};
