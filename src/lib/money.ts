export interface FormattedMoney {
  symbol: string;
  whole: string;
  decimal: string; // includes dot, e.g. ".00"
  full: string;
}

export const SUPPORTED_CURRENCIES = [
  { code: 'AED', symbol: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'AU$', label: 'Australian Dollar (AU$)' },
];

/** Currency used when nothing is chosen and the region is unknown. */
export const FALLBACK_CURRENCY = 'AED';

const EURO_REGIONS = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];

/**
 * Picks a starting currency from the device: its region (en-AE, en-IN, ...) and,
 * because many phones in the UAE are set to en-US or en-GB, its time zone.
 */
export function detectDefaultCurrency(
  locale: string = typeof navigator !== 'undefined' ? navigator.language : '',
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
): string {
  if (timeZone === 'Asia/Dubai') return 'AED';
  if (timeZone === 'Asia/Kolkata' || timeZone === 'Asia/Calcutta') return '₹';

  let region = '';
  try {
    region = (new Intl.Locale(locale).maximize().region || '').toUpperCase();
  } catch {
    region = (locale.split('-')[1] || '').toUpperCase();
  }
  if (region === 'AE') return 'AED';
  if (region === 'IN') return '₹';
  if (region === 'US') return '$';
  if (region === 'GB') return '£';
  if (region === 'JP') return '¥';
  if (region === 'CA') return 'CA$';
  if (region === 'AU') return 'AU$';
  if (EURO_REGIONS.includes(region)) return '€';
  return FALLBACK_CURRENCY;
}

export function getStoredCurrency(): string {
  try {
    const saved = localStorage.getItem('expense_currency');
    if (saved) return saved;
  } catch {
    // ignore
  }
  return detectDefaultCurrency();
}

/** Symbol plus a space when it is letters ("AED 250"), none for signs ("₹250", "$18.50"). */
export function currencyPrefix(symbol: string): string {
  return /[A-Za-z]$/.test(symbol) ? `${symbol} ` : symbol;
}

export function setStoredCurrency(symbol: string): void {
  try {
    localStorage.setItem('expense_currency', symbol);
  } catch {
    // ignore
  }
}

export function formatMoney(amount: number, symbol = FALLBACK_CURRENCY): FormattedMoney {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  
  // Format with standard grouping
  const parts = abs.toFixed(2).split('.');
  const wholePart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalPart = `.${parts[1]}`;
  const prefix = isNegative ? '-' : '';
  const sym = currencyPrefix(symbol);

  return {
    symbol,
    whole: `${prefix}${sym}${wholePart}`,
    decimal: decimalPart,
    full: `${prefix}${sym}${wholePart}${decimalPart}`,
  };
}

/**
 * Calculates spending for the current month up to the current day,
 * and compares it with the previous month up to the exact same day of month.
 * e.g., "₹2,140 more than by this day in October"
 */
export function calculateMonthComparison(
  currentMonthExpenses: { amount: number; createdAt: string }[],
  lastMonthExpenses: { amount: number; createdAt: string }[],
  currency = FALLBACK_CURRENCY,
  now = new Date()
): { text: string; delta: number; isHigher: boolean } {
  const currentDay = now.getDate();

  // Sum current month up to current day (all current month entries are <= today)
  const currentTotal = currentMonthExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Sum last month only up to the same day of month
  const lastMonthCutoffTotal = lastMonthExpenses.reduce((acc, curr) => {
    const d = new Date(curr.createdAt);
    if (d.getDate() <= currentDay) {
      return acc + curr.amount;
    }
    return acc;
  }, 0);

  if (lastMonthExpenses.length === 0) {
    return {
      text: 'First recorded month of spending',
      delta: 0,
      isHigher: false,
    };
  }

  const diff = currentTotal - lastMonthCutoffTotal;
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', {
    month: 'long',
  });

  if (Math.abs(diff) < 1) {
    return {
      text: `Same as by this day in ${lastMonthName}`,
      delta: 0,
      isHigher: false,
    };
  }

  const diffFormatted = formatMoney(Math.abs(diff), currency).full;
  if (diff > 0) {
    return {
      text: `${diffFormatted} more than by this day in ${lastMonthName}`,
      delta: diff,
      isHigher: true,
    };
  } else {
    return {
      text: `${diffFormatted} less than by this day in ${lastMonthName}`,
      delta: diff,
      isHigher: false,
    };
  }
}
