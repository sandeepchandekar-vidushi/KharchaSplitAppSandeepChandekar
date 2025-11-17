/**
 * Phone number formatting utilities for consistent display across the app
 */

/**
 * Format phone number for display with consistent spacing
 * Handles various input formats and converts to standardized display format
 *
 * Input formats: +918669854164, +91 97620 24444, 9188888874400, 08888874400, etc.
 * Output format: +91 8669 985 4164 (for Indian numbers)
 *
 * @param phoneNumber - Phone number in any format
 * @returns Formatted phone number with consistent spacing
 */
export const formatPhoneForDisplay = (phoneNumber: string): string => {
  if (!phoneNumber) {
    return '';
  }

  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Handle 10-digit Indian numbers (without country code)
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }

  // Handle 11-digit numbers starting with 0 (remove leading 0)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    const without0 = cleaned.substring(1);
    return `+91 ${without0.slice(0, 5)} ${without0.slice(5)}`;
  }

  // Handle 12-digit numbers with country code 91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    const last10 = cleaned.substring(2);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  }

  // Handle 13-digit numbers with country code 091
  if (cleaned.length === 13 && cleaned.startsWith('091')) {
    const last10 = cleaned.substring(3);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  }

  // Fallback: return original if doesn't match Indian format
  return phoneNumber;
};

/**
 * Normalize phone number to 10-digit format for storage and comparison
 * Removes country code, spaces, and special characters
 *
 * @param phoneNumber - Phone number in any format
 * @returns 10-digit normalized phone number
 */
export const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) {
    return '';
  }

  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Handle Indian phone numbers - normalize to 10-digit format without country code
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    // Remove country code 91
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // Remove leading 0
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 10) {
    // Already in correct 10-digit format
  }

  return cleaned;
};
