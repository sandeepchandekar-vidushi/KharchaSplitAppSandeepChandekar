const { query } = require('../config/database');

class User {
  /**
   * Find user by ID
   */
  static async findById(id) {
    const result = await query(
      'SELECT id, phone_number, name, email, profile_image_base64, preferred_currency, created_at, updated_at FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by phone number
   */
  static async findByPhoneNumber(phoneNumber) {
    const result = await query(
      'SELECT id, phone_number, name, email, profile_image_base64, preferred_currency, created_at, updated_at FROM users WHERE phone_number = $1 AND deleted_at IS NULL',
      [phoneNumber]
    );
    return result.rows[0] || null;
  }

  /**
   * Create new user
   */
  static async create(userData) {
    const { phoneNumber, name, email, profileImageBase64, preferredCurrency } = userData;
    const result = await query(
      `INSERT INTO users (phone_number, name, email, profile_image_base64, preferred_currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, phone_number, name, email, profile_image_base64, preferred_currency, created_at`,
      [phoneNumber, name, email || null, profileImageBase64 || null, preferredCurrency || 'INR']
    );
    return result.rows[0];
  }

  /**
   * Update user
   */
  static async update(id, userData) {
    const { name, email, profileImageBase64, preferredCurrency } = userData;
    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           profile_image_base64 = COALESCE($3, profile_image_base64),
           preferred_currency = COALESCE($4, preferred_currency),
           updated_at = NOW()
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING id, phone_number, name, email, profile_image_base64, preferred_currency, updated_at`,
      [name, email, profileImageBase64, preferredCurrency, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Soft delete user
   */
  static async delete(id) {
    const result = await query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if user exists
   */
  static async exists(phoneNumber) {
    const result = await query(
      'SELECT id FROM users WHERE phone_number = $1 AND deleted_at IS NULL',
      [phoneNumber]
    );
    return result.rows.length > 0;
  }
}

module.exports = User;
