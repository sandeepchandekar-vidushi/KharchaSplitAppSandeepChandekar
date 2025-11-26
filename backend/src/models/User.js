import { query  } from '../config/database.js';

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
   * Uses normalized matching to handle different phone formats (+91, 91, spaces, etc.)
   */
  static async findByPhoneNumber(phoneNumber) {
    // Normalize the input phone number to last 10 digits
    const normalizedPhone = this.normalizePhoneForSearch(phoneNumber);

    const result = await query(
      `SELECT id, phone_number, name, email, profile_image_base64, preferred_currency, created_at, updated_at
       FROM users
       WHERE RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), 10) = $1
       AND deleted_at IS NULL`,
      [normalizedPhone]
    );
    return result.rows[0] || null;
  }

  /**
   * Normalize phone number to consistent format for matching
   * Extracts last 10 digits (Indian phone numbers without country code)
   */
  static normalizePhoneForSearch(phoneNumber) {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // Get last 10 digits (handles +91, 91, 0 prefixes)
    if (digitsOnly.length >= 10) {
      return digitsOnly.slice(-10);
    }
    return digitsOnly;
  }

  /**
   * Find users by multiple phone numbers (bulk query for performance)
   * Uses WHERE IN clause to fetch all users in a single query
   * Normalizes phone numbers to match regardless of format (+91, 91, spaces, etc.)
   */
  static async findByPhoneNumbers(phoneNumbers) {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return [];
    }

    // Normalize input phone numbers to last 10 digits
    const normalizedPhones = phoneNumbers.map(p => this.normalizePhoneForSearch(p));

    // Create placeholders for parameterized query: $1, $2, $3, etc.
    const placeholders = normalizedPhones.map((_, i) => `$${i + 1}`).join(', ');

    // Use RIGHT() function to compare last 10 digits of stored phone numbers
    // This handles cases where DB has +91XXXXXXXXXX and query has just XXXXXXXXXX or vice versa
    const result = await query(
      `SELECT id, phone_number, name, email, profile_image_base64, preferred_currency, created_at, updated_at
       FROM users
       WHERE RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g'), 10) IN (${placeholders})
       AND deleted_at IS NULL`,
      normalizedPhones
    );

    return result.rows;
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

export default User;
