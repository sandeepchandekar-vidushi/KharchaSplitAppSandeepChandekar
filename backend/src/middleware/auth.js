import jwt from 'jsonwebtoken';
import { query  } from '../config/database.js';

/**
 * Middleware to verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is not deleted
    const result = await query(
      'SELECT id, phone_number, name, email FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token - user not found',
      });
    }

    // Attach user to request
    req.user = {
      id: result.rows[0].id,
      phone_number: result.rows[0].phone_number,
      name: result.rows[0].name,
      email: result.rows[0].email,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication - adds user if token is valid, but doesn't fail if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, phone_number, name, email FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      req.user = result.rows[0];
    }

    next();
  } catch (error) {
    // Silently fail - just don't add user
    next();
  }
};

export {
  authenticate,
  optionalAuth,
};
