import bcrypt from 'bcryptjs';
import { query  } from '../config/database.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken  } from '../utils/jwt.js';
import { generateOTP, getOTPExpiry, sendOTPviaSMS  } from '../utils/otp.js';

/**
 * Register new user
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { phoneNumber, name, email } = req.body;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE phone_number = $1 AND deleted_at IS NULL',
      [phoneNumber]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this phone number already exists',
      });
    }

    // Create user
    const result = await query(
      `INSERT INTO users (phone_number, name, email)
       VALUES ($1, $2, $3)
       RETURNING id, phone_number, name, email, created_at`,
      [phoneNumber, name, email || null]
    );

    const user = result.rows[0];

    // Generate OTP (use test OTP for test phone number)
    const otp = phoneNumber === '+919822192700' ? '123456' : generateOTP();
    const expiresAt = getOTPExpiry();

    // Save OTP
    await query(
      'INSERT INTO otps (phone_number, otp, expires_at) VALUES ($1, $2, $3)',
      [phoneNumber, otp, expiresAt]
    );

    // Send OTP (skip WATI for test phone number since it will fail anyway)
    if (phoneNumber !== '+919822192700') {
      await sendOTPviaSMS(phoneNumber, otp);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. OTP sent to your phone.',
      data: {
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send OTP for login
 * POST /api/v1/auth/send-otp
 */
const sendOTP = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    // Check if user exists
    const userResult = await query(
      'SELECT id FROM users WHERE phone_number = $1 AND deleted_at IS NULL',
      [phoneNumber]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please register first.',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry();

    // Delete old OTPs for this phone number
    await query('DELETE FROM otps WHERE phone_number = $1', [phoneNumber]);

    // Save new OTP
    await query(
      'INSERT INTO otps (phone_number, otp, expires_at) VALUES ($1, $2, $3)',
      [phoneNumber, otp, expiresAt]
    );

    // Send OTP
    await sendOTPviaSMS(phoneNumber, otp);

    res.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP and login
 * POST /api/v1/auth/verify-otp
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Verify OTP
    const otpResult = await query(
      `SELECT * FROM otps
       WHERE phone_number = $1
       AND otp = $2
       AND expires_at > NOW()
       AND verified = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [phoneNumber, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired OTP',
      });
    }

    // Mark OTP as verified
    await query('UPDATE otps SET verified = TRUE WHERE id = $1', [otpResult.rows[0].id]);

    // Get user
    const userResult = await query(
      'SELECT id, phone_number, name, email, profile_image_base64, preferred_currency, created_at FROM users WHERE phone_number = $1 AND deleted_at IS NULL',
      [phoneNumber]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = userResult.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, refreshExpiresAt]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          name: user.name,
          email: user.email,
          profileImage: user.profile_image_base64,
          preferredCurrency: user.preferred_currency,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Check if refresh token exists and is not expired
    const tokenResult = await query(
      `SELECT * FROM refresh_tokens
       WHERE token = $1
       AND expires_at > NOW()
       LIMIT 1`,
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not found or expired',
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(decoded.userId);

    res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete refresh token
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Simple login with just phone number (no OTP)
 * POST /api/v1/auth/simple-login
 */
const simpleLogin = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Check if user exists
    const userResult = await query(
      'SELECT id, phone_number, name, email, profile_image_base64, preferred_currency, created_at FROM users WHERE phone_number = $1 AND deleted_at IS NULL',
      [phoneNumber]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found. Please complete registration first.',
      });
    }

    const user = userResult.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, refreshExpiresAt]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          name: user.name,
          email: user.email,
          profileImageBase64: user.profile_image_base64,
          preferredCurrency: user.preferred_currency,
          createdAt: user.created_at,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  sendOTP,
  verifyOTP,
  refreshAccessToken,
  logout,
  simpleLogin,
};
