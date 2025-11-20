const User = require('../models/User');

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

module.exports = {
  getUser,
  updateUser,
  deleteUser,
};
