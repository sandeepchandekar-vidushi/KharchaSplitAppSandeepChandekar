/**
 * OCR API Service
 * Handles bill scanning and data extraction via backend OCR processing
 */

import axios, { AxiosInstance } from 'axios';
import { tokenStorage } from '../tokenStorage';

// For local testing, use computer's IP address
// const API_BASE_URL = 'http://192.168.1.8:3000/api/v1';
const API_BASE_URL = 'https://api.kharchasplit.com/api/v1';


// Create axios instance with longer timeout for OCR processing
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for OCR processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          if (response.data.success) {
            const { accessToken } = response.data.data;
            await tokenStorage.saveAccessToken(accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        await tokenStorage.clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Types for OCR response
export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OCRResult {
  invoiceNumber?: string;
  merchantName?: string;
  dateOfIssue?: string;
  totalAmount?: number;
  subtotal?: number;
  tax?: number;
  lineItems: LineItem[];
  suggestedCategory?: string;
  currency?: string;
  rawText?: string;
  confidence: number;
}

export interface ScanBillResponse {
  success: boolean;
  message: string;
  data: OCRResult;
}

// Category keywords for auto-detection
const categoryKeywords: Record<string, string[]> = {
  Food: ['restaurant', 'cafe', 'food', 'dining', 'pizza', 'burger', 'kitchen', 'bistro', 'diner', 'eatery', 'swiggy', 'zomato', 'uber eats', 'doordash'],
  Transportation: ['uber', 'ola', 'taxi', 'cab', 'petrol', 'diesel', 'fuel', 'gas station', 'metro', 'bus', 'train', 'parking', 'toll'],
  Shopping: ['store', 'mall', 'shop', 'mart', 'amazon', 'flipkart', 'retail', 'boutique', 'fashion', 'clothing', 'electronics'],
  Drinks: ['bar', 'pub', 'brewery', 'wine', 'beer', 'cocktail', 'spirits', 'liquor', 'cafe', 'coffee', 'starbucks'],
  Entertainment: ['cinema', 'movie', 'theatre', 'concert', 'event', 'ticket', 'netflix', 'spotify', 'gaming', 'park', 'museum'],
  Health: ['pharmacy', 'medical', 'hospital', 'clinic', 'doctor', 'medicine', 'health', 'apollo', 'chemist', 'lab', 'diagnostic'],
};

/**
 * Detect category from merchant name or line items
 */
const detectCategory = (merchantName?: string, lineItems?: LineItem[]): string => {
  const textToSearch = [
    merchantName?.toLowerCase() || '',
    ...(lineItems?.map(item => item.description.toLowerCase()) || []),
  ].join(' ');

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (textToSearch.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'Other';
};

/**
 * Parse date from various formats
 */
const parseDate = (dateString?: string): string | undefined => {
  if (!dateString) return undefined;

  // Try various date formats
  const formats = [
    // DD/MM/YYYY, DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // YYYY/MM/DD, YYYY-MM-DD
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // DD MMM YYYY, DD Month YYYY
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
  ];

  for (const format of formats) {
    const match = dateString.match(format);
    if (match) {
      try {
        let date: Date;
        if (format === formats[0]) {
          // DD/MM/YYYY
          date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        } else if (format === formats[1]) {
          // YYYY/MM/DD
          date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else {
          // DD Month YYYY
          date = new Date(dateString);
        }
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      } catch {
        continue;
      }
    }
  }

  return undefined;
};

/**
 * Local OCR parsing fallback using regex patterns
 * This provides basic extraction when backend OCR is unavailable
 */
const localOCRParsing = (rawText: string): OCRResult => {
  const result: OCRResult = {
    lineItems: [],
    confidence: 0.3, // Low confidence for local parsing
  };

  // Extract invoice/receipt number
  const invoiceMatch = rawText.match(/(?:invoice|receipt|bill|order)\s*(?:#|no\.?|number)?[:\s]*([A-Z0-9\-]+)/i);
  if (invoiceMatch) {
    result.invoiceNumber = invoiceMatch[1];
  }

  // Extract date
  const dateMatch = rawText.match(/(?:date|dated?)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})/i);
  if (dateMatch) {
    result.dateOfIssue = parseDate(dateMatch[1]);
  }

  // Extract total amount - look for various patterns
  const totalPatterns = [
    /(?:total|grand\s*total|amount\s*due|net\s*amount)[:\s]*(?:₹|rs\.?|inr|usd|\$|€|£)?\s*([\d,]+\.?\d*)/i,
    /(?:₹|rs\.?)\s*([\d,]+\.?\d*)\s*(?:total|due)/i,
  ];

  for (const pattern of totalPatterns) {
    const totalMatch = rawText.match(pattern);
    if (totalMatch) {
      result.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
      break;
    }
  }

  // Extract subtotal
  const subtotalMatch = rawText.match(/(?:subtotal|sub\s*total)[:\s]*(?:₹|rs\.?|inr|usd|\$|€|£)?\s*([\d,]+\.?\d*)/i);
  if (subtotalMatch) {
    result.subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
  }

  // Extract tax
  const taxMatch = rawText.match(/(?:tax|gst|vat|cgst|sgst)[:\s]*(?:₹|rs\.?|inr|usd|\$|€|£)?\s*([\d,]+\.?\d*)/i);
  if (taxMatch) {
    result.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
  }

  // Detect currency
  if (rawText.match(/₹|rs\.?|inr/i)) {
    result.currency = 'INR';
  } else if (rawText.match(/\$|usd/i)) {
    result.currency = 'USD';
  } else if (rawText.match(/€|eur/i)) {
    result.currency = 'EUR';
  } else if (rawText.match(/£|gbp/i)) {
    result.currency = 'GBP';
  }

  // Try to extract merchant name from first line or near logo area
  const lines = rawText.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    // First non-empty line is often the merchant name
    const firstLine = lines[0].trim();
    if (firstLine.length > 2 && firstLine.length < 50 && !firstLine.match(/^\d/)) {
      result.merchantName = firstLine;
    }
  }

  // Detect category
  result.suggestedCategory = detectCategory(result.merchantName, result.lineItems);

  result.rawText = rawText;

  return result;
};

/**
 * Enhanced local OCR parsing with better pattern matching
 * Extracts amount, date, merchant name from OCR text
 */
const enhancedLocalOCRParsing = (rawText: string): OCRResult => {
  const result: OCRResult = {
    lineItems: [],
    confidence: 0.5,
    rawText: rawText,
  };

  const text = rawText.toLowerCase();
  const originalText = rawText;

  // === EXTRACT TOTAL AMOUNT ===
  // Priority: Look for "Total" that is NOT "Subtotal" first
  let totalAmount: number | undefined;

  // First, try to find explicit "Grand Total" or "Total" (excluding Subtotal)
  const grandTotalMatch = originalText.match(/grand\s*total[:\s]*(?:₹|rs\.?|inr\.?|र)?\s*([\d,]+\.?\d*)/i);
  if (grandTotalMatch) {
    totalAmount = parseFloat(grandTotalMatch[1].replace(/,/g, ''));
    console.log('[OCR] Found Grand Total:', totalAmount);
  }

  // Try "Total" that's not preceded by "Sub"
  if (!totalAmount) {
    const totalMatches = [...originalText.matchAll(/(?<!sub)total[:\s]*(?:₹|rs\.?|inr\.?|र)?\s*([\d,]+\.?\d*)/gi)];
    if (totalMatches.length > 0) {
      // Take the last "Total" match as it's usually the final total
      const lastMatch = totalMatches[totalMatches.length - 1];
      totalAmount = parseFloat(lastMatch[1].replace(/,/g, ''));
      console.log('[OCR] Found Total (not subtotal):', totalAmount);
    }
  }

  // Try "Net Total" or "Net Amount"
  if (!totalAmount) {
    const netMatch = originalText.match(/net\s*(?:total|amount|amt)?[:\s]*(?:₹|rs\.?|inr\.?|र)?\s*([\d,]+\.?\d*)/i);
    if (netMatch) {
      totalAmount = parseFloat(netMatch[1].replace(/,/g, ''));
      console.log('[OCR] Found Net Total:', totalAmount);
    }
  }

  // Try "Amount Payable" or "Amount Due"
  if (!totalAmount) {
    const payableMatch = originalText.match(/amount\s*(?:payable|due)[:\s]*(?:₹|rs\.?|inr\.?|र)?\s*([\d,]+\.?\d*)/i);
    if (payableMatch) {
      totalAmount = parseFloat(payableMatch[1].replace(/,/g, ''));
      console.log('[OCR] Found Amount Payable:', totalAmount);
    }
  }

  // Try "Bill Amount" or "Bill Total"
  if (!totalAmount) {
    const billMatch = originalText.match(/bill\s*(?:amount|total)[:\s]*(?:₹|rs\.?|inr\.?|र)?\s*([\d,]+\.?\d*)/i);
    if (billMatch) {
      totalAmount = parseFloat(billMatch[1].replace(/,/g, ''));
      console.log('[OCR] Found Bill Amount:', totalAmount);
    }
  }

  // Fallback: Find all currency amounts and take the largest
  if (!totalAmount || totalAmount < 1) {
    const currencyMatches = [...originalText.matchAll(/(?:₹|rs\.?\s*)([\d,]+\.?\d*)/gi)];
    const amounts = currencyMatches
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(a => a >= 1 && a < 10000000);

    if (amounts.length > 0) {
      totalAmount = Math.max(...amounts);
      console.log('[OCR] Fallback - Found currency amounts:', amounts.slice(0, 5), 'Selected:', totalAmount);
    }
  }

  if (totalAmount && totalAmount >= 1) {
    result.totalAmount = totalAmount;
    result.confidence = 0.6;
  }

  // === EXTRACT DATE ===
  // Try multiple date formats and patterns
  let extractedDate: string | undefined;

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY (most common Indian format)
  const ddmmyyyyMatch = originalText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1]);
    const month = parseInt(ddmmyyyyMatch[2]);
    const year = parseInt(ddmmyyyyMatch[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        extractedDate = date.toISOString();
        console.log('[OCR] Found date DD/MM/YYYY:', ddmmyyyyMatch[0]);
      }
    }
  }

  // Pattern 2: DD/MM/YY or DD-MM-YY
  if (!extractedDate) {
    const ddmmyyMatch = originalText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/);
    if (ddmmyyMatch) {
      const day = parseInt(ddmmyyMatch[1]);
      const month = parseInt(ddmmyyMatch[2]);
      let year = parseInt(ddmmyyMatch[3]);
      year = year < 50 ? 2000 + year : 1900 + year; // Assume 00-49 is 2000s, 50-99 is 1900s
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          extractedDate = date.toISOString();
          console.log('[OCR] Found date DD/MM/YY:', ddmmyyMatch[0]);
        }
      }
    }
  }

  // Pattern 3: DD MMM YYYY or DD Month YYYY (e.g., "24 Nov 2025" or "24 November 2025")
  if (!extractedDate) {
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11
    };
    const monthMatch = originalText.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[,\s]*(\d{4})/i);
    if (monthMatch) {
      const day = parseInt(monthMatch[1]);
      const monthStr = monthMatch[2].toLowerCase();
      const year = parseInt(monthMatch[3]);
      const month = monthNames[monthStr];
      if (month !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          extractedDate = date.toISOString();
          console.log('[OCR] Found date DD MMM YYYY:', monthMatch[0]);
        }
      }
    }
  }

  // Pattern 4: YYYY-MM-DD (ISO format)
  if (!extractedDate) {
    const isoMatch = originalText.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          extractedDate = date.toISOString();
          console.log('[OCR] Found date YYYY-MM-DD:', isoMatch[0]);
        }
      }
    }
  }

  if (extractedDate) {
    result.dateOfIssue = extractedDate;
  }

  // === EXTRACT INVOICE NUMBER ===
  const invoicePatterns = [
    /(?:invoice|inv|receipt|bill|order|ref|txn)\s*(?:#|no\.?|number|num)?[:\s]*([A-Z0-9\-\/]+)/gi,
    /(?:#|no\.?)[:\s]*([A-Z0-9\-]{4,})/gi,
  ];

  for (const pattern of invoicePatterns) {
    const match = originalText.match(pattern);
    if (match) {
      // Extract just the number part
      const numMatch = match[0].match(/([A-Z0-9\-\/]{4,})/i);
      if (numMatch) {
        result.invoiceNumber = numMatch[1].toUpperCase();
        break;
      }
    }
  }

  // === EXTRACT MERCHANT NAME ===
  const lines = originalText.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Look for merchant name - usually in first few lines, not a number
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    // Skip lines that are mostly numbers or very short
    if (line.length > 3 && line.length < 60 && !/^\d+$/.test(line) && !/^[₹$€£]/.test(line)) {
      // Skip lines that look like addresses or dates
      if (!/^\d{1,2}[\/\-]/.test(line) && !/^tel|^ph|^mob|^add|^gst/i.test(line)) {
        result.merchantName = line.split(/[,\n]/)[0].trim();
        break;
      }
    }
  }

  // === DETECT CURRENCY ===
  if (text.includes('₹') || text.includes('rs') || text.includes('inr') || text.includes('rupee')) {
    result.currency = 'INR';
  } else if (text.includes('$') || text.includes('usd') || text.includes('dollar')) {
    result.currency = 'USD';
  } else if (text.includes('€') || text.includes('eur')) {
    result.currency = 'EUR';
  } else if (text.includes('£') || text.includes('gbp')) {
    result.currency = 'GBP';
  } else {
    result.currency = 'INR'; // Default to INR for Indian app
  }

  // === DETECT CATEGORY ===
  result.suggestedCategory = detectCategory(result.merchantName, result.lineItems);

  // === EXTRACT TAX ===
  const taxPatterns = [
    /(?:gst|cgst|sgst|igst|tax|vat)[:\s]*(?:₹|rs\.?)?\s*([\d,]+\.?\d*)/gi,
    /(?:₹|rs\.?)\s*([\d,]+\.?\d*)\s*(?:tax|gst)/gi,
  ];

  for (const pattern of taxPatterns) {
    const match = originalText.match(pattern);
    if (match) {
      const taxStr = match[0].match(/([\d,]+\.?\d*)/);
      if (taxStr) {
        result.tax = parseFloat(taxStr[1].replace(/,/g, ''));
        break;
      }
    }
  }

  return result;
};

// API Service
export const ocrApi = {
  /**
   * Scan a bill image and extract data
   * Uses backend OCR if available, falls back to ML Kit text recognition
   */
  async scanBill(imageBase64: string): Promise<ScanBillResponse> {
    try {
      // Try backend OCR first
      const response = await apiClient.post('/ocr/scan-bill', {
        imageBase64: imageBase64.startsWith('data:')
          ? imageBase64.split(',')[1] // Remove data URI prefix
          : imageBase64,
      });

      const data = response.data.data;

      // Parse date if present
      if (data.dateOfIssue) {
        data.dateOfIssue = parseDate(data.dateOfIssue) || data.dateOfIssue;
      }

      // Add category detection if not provided
      if (!data.suggestedCategory) {
        data.suggestedCategory = detectCategory(data.merchantName, data.lineItems);
      }

      return {
        success: true,
        message: 'Bill scanned successfully',
        data,
      };
    } catch (error: any) {
      console.log('Backend OCR unavailable:', error.message);

      // Return result indicating ML Kit should be used
      // The ScanScreen will handle ML Kit text recognition
      return {
        success: true,
        message: 'Use on-device OCR',
        data: {
          lineItems: [],
          confidence: 0,
          suggestedCategory: 'Other',
          currency: 'INR',
        },
      };
    }
  },

  /**
   * Parse raw OCR text to extract bill details
   * This is called after ML Kit extracts text from image
   */
  parseOCRText(rawText: string): OCRResult {
    if (!rawText || rawText.trim().length === 0) {
      return {
        lineItems: [],
        confidence: 0,
        suggestedCategory: 'Other',
        currency: 'INR',
      };
    }
    return enhancedLocalOCRParsing(rawText);
  },

  /**
   * Parse raw OCR text locally (for testing or offline use)
   */
  parseLocally(rawText: string): OCRResult {
    return enhancedLocalOCRParsing(rawText);
  },
};

export default ocrApi;
