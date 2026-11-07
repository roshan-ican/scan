import { CATEGORY_NAMES, CategoryDef, getCategoryDef } from './categories.ts';

export interface RawGeminiReceiptResponse {
  merchant?: string | null;
  total?: number | null;
  currency?: string | null;
  date?: string | null;
  category?: string | null;
  total_line?: string | null;
  items?: Array<{ name: string; amount: number }> | null;
}

export interface ValidatedScanResult {
  merchant: string;
  total: number | null;
  currency: string;
  date: string; // YYYY-MM-DD
  category: string;
  totalLine: string; // Proof line: e.g. "GRAND TOTAL  1,240.00"
  items: Array<{ name: string; amount: number }>;
  isComplete: boolean;
  validationErrors: string[];
}

/**
 * Validates and normalizes raw JSON returned from Gemini receipt reading.
 * Enforces:
 * - total > 0 (or null if unreadable)
 * - valid date <= today (defaults to today's date if invalid/missing or in future)
 * - category mapped into one of the 9 allowed categories
 * - total_line preserved as proof
 */
export function parseAndValidateScanResult(
  raw: any,
  fallbackCurrency = 'AED',
  referenceDate = new Date()
): ValidatedScanResult | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const errors: string[] = [];

  // 1. Merchant
  const merchant = typeof raw.merchant === 'string' ? raw.merchant.trim() : '';

  // 2. Total
  let total: number | null = null;
  if (typeof raw.total === 'number' && !isNaN(raw.total) && raw.total > 0) {
    total = Math.round(raw.total * 100) / 100;
  } else if (typeof raw.total === 'string') {
    // Attempt parse if string returned
    const cleaned = raw.total.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      total = Math.round(num * 100) / 100;
    }
  }

  if (total === null) {
    errors.push('Could not detect total amount');
  }

  // 3. Date (must be YYYY-MM-DD and not in future)
  const todayStr = referenceDate.toISOString().split('T')[0];
  let date = todayStr;

  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    const parsedDate = new Date(raw.date);
    // Compare YYYY-MM-DD with today
    if (!isNaN(parsedDate.getTime())) {
      if (raw.date <= todayStr) {
        date = raw.date;
      } else {
        // Future date printed on receipt or misread -> fallback to today
        date = todayStr;
      }
    }
  }

  // 4. Category
  let category = 'Other';
  if (typeof raw.category === 'string') {
    const matched = CATEGORY_NAMES.find(
      (c) => c.toLowerCase() === raw.category.trim().toLowerCase()
    );
    if (matched) {
      category = matched;
    }
  }

  // 5. Currency
  let currency = fallbackCurrency;
  if (typeof raw.currency === 'string' && raw.currency.trim()) {
    const cur = raw.currency.trim();
    if (['AED', 'Dhs', 'Dhs.', 'DHS', 'Dh', 'DH', 'د.إ', 'درهم'].includes(cur)) currency = 'AED';
    else if (['₹', 'INR', 'Rs', 'Rs.'].includes(cur)) currency = '₹';
    else if (['$', 'USD'].includes(cur)) currency = '$';
    else if (['€', 'EUR'].includes(cur)) currency = '€';
    else if (['£', 'GBP'].includes(cur)) currency = '£';
    else if (['¥', 'JPY'].includes(cur)) currency = '¥';
    else currency = cur;
  }

  // 6. Proof: total_line
  let totalLine = '';
  if (typeof raw.total_line === 'string' && raw.total_line.trim()) {
    totalLine = raw.total_line.trim();
  } else if (total !== null) {
    totalLine = `TOTAL ${total.toFixed(2)}`;
  }

  // 7. Items
  const items: Array<{ name: string; amount: number }> = [];
  if (Array.isArray(raw.items)) {
    for (const item of raw.items) {
      if (item && typeof item.name === 'string') {
        const amt = typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0;
        items.push({
          name: item.name.trim(),
          amount: Math.round(amt * 100) / 100,
        });
      }
    }
  }

  // If both merchant and total are null/empty, it's not a usable receipt
  if (!merchant && total === null) {
    return null;
  }

  const isComplete = Boolean(merchant && total !== null && total > 0);

  return {
    merchant,
    total,
    currency,
    date,
    category,
    totalLine,
    items,
    isComplete,
    validationErrors: errors,
  };
}
