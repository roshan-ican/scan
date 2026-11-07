import Dexie, { type Table } from 'dexie';

export interface ExpenseItem {
  name: string;
  amount: number;
}

export interface Expense {
  id?: number;
  amount: number;
  currency: string;
  category: string;
  merchant?: string;
  note?: string;
  createdAt: string; // ISO string e.g. 2026-11-07T14:32:00.000Z
  source: 'typed' | 'scan';
  receiptDate?: string; // YYYY-MM-DD
  totalLine?: string; // Exact proof line from scan
  rawText?: string;
  items?: ExpenseItem[];
  receiptImage?: string; // compressed thumbnail dataUrl
}

export class ExpenseDatabase extends Dexie {
  expenses!: Table<Expense, number>;

  constructor() {
    super('ExpenseTrackerDB');
    this.version(1).stores({
      expenses: '++id, createdAt, category, source, amount, receiptDate, merchant',
    });
  }
}

export const db = new ExpenseDatabase();

/**
 * Safari & Mobile Web Persistent Storage Check
 */
export async function checkStorageStatus(): Promise<{ persisted: boolean; quota?: number; usage?: number }> {
  if (typeof navigator !== 'undefined' && navigator.storage) {
    const isPersisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    let quota: number | undefined;
    let usage: number | undefined;
    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota;
      usage = estimate.usage;
    }
    return { persisted: isPersisted, quota, usage };
  }
  return { persisted: false };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}

/**
 * Seed data for development and initial run
 */
export async function initializeSeedDataIfEmpty(currency = '₹'): Promise<boolean> {
  const count = await db.expenses.count();
  if (count > 0) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Sample data designed to showcase real month comparison and category breakdown
  // Current month expenses (November)
  const seedItems: Expense[] = [
    {
      amount: 450.0,
      currency,
      category: 'Food & Dining',
      merchant: 'Third Wave Coffee',
      note: 'Pour-over and avocado toast',
      createdAt: new Date(currentYear, currentMonth, now.getDate(), 9, 30).toISOString(),
      source: 'typed',
      receiptDate: new Date(currentYear, currentMonth, now.getDate()).toISOString().split('T')[0],
    },
    {
      amount: 1240.0,
      currency,
      category: 'Groceries',
      merchant: 'Nature\'s Basket',
      note: 'Weekly essentials and berries',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 1), 18, 45).toISOString(),
      source: 'scan',
      receiptDate: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 1)).toISOString().split('T')[0],
      totalLine: 'GRAND TOTAL  1,240.00',
      items: [
        { name: 'Organic Almonds 500g', amount: 480.0 },
        { name: 'Fresh Blueberries', amount: 350.0 },
        { name: 'Greek Yogurt 400g', amount: 190.0 },
        { name: 'Sourdough Loaf', amount: 220.0 },
      ],
    },
    {
      amount: 280.0,
      currency,
      category: 'Transport',
      merchant: 'Uber Auto',
      note: 'Ride to metro station',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 2), 8, 15).toISOString(),
      source: 'typed',
      receiptDate: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 2)).toISOString().split('T')[0],
    },
    {
      amount: 2199.0,
      currency,
      category: 'Shopping',
      merchant: 'Uniqlo',
      note: 'AIRism cotton tee and socks',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 3), 16, 20).toISOString(),
      source: 'scan',
      receiptDate: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 3)).toISOString().split('T')[0],
      totalLine: 'TOTAL INCL. GST  2,199.00',
      items: [
        { name: 'AIRism Cotton Crew', amount: 1490.0 },
        { name: 'Pile Socks 3P', amount: 709.0 },
      ],
    },
    {
      amount: 890.0,
      currency,
      category: 'Bills & Utilities',
      merchant: 'Airtel Fiber',
      note: 'Monthly broadband bill',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 4), 11, 0).toISOString(),
      source: 'typed',
      receiptDate: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 4)).toISOString().split('T')[0],
    },
    {
      amount: 540.0,
      currency,
      category: 'Health',
      merchant: 'Apollo Pharmacy',
      note: 'Vitamins and throat lozenges',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 5), 20, 10).toISOString(),
      source: 'scan',
      receiptDate: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 5)).toISOString().split('T')[0],
      totalLine: 'NET AMOUNT PAYABLE  540.00',
      items: [
        { name: 'Zincovit Tablets', amount: 310.0 },
        { name: 'Strepsils Honey Lemon', amount: 230.0 },
      ],
    },

    // Prior month baseline entries (October) to compute comparison
    {
      amount: 650.0,
      currency,
      category: 'Food & Dining',
      merchant: 'Subway',
      note: 'Quick lunch',
      createdAt: new Date(currentYear, currentMonth - 1, 2, 13, 0).toISOString(),
      source: 'typed',
      receiptDate: new Date(currentYear, currentMonth - 1, 2).toISOString().split('T')[0],
    },
    {
      amount: 980.0,
      currency,
      category: 'Groceries',
      merchant: 'Blinkit',
      note: 'Pantry items',
      createdAt: new Date(currentYear, currentMonth - 1, 4, 17, 30).toISOString(),
      source: 'typed',
      receiptDate: new Date(currentYear, currentMonth - 1, 4).toISOString().split('T')[0],
    },
    {
      amount: 1829.0,
      currency,
      category: 'Transport',
      merchant: 'Airport Cab',
      note: 'Terminal 2 drop',
      createdAt: new Date(currentYear, currentMonth - 1, 5, 6, 0).toISOString(),
      source: 'scan',
      receiptDate: new Date(currentYear, currentMonth - 1, 5).toISOString().split('T')[0],
      totalLine: 'TOTAL CHARGED: ₹1,829.00',
    },
  ];

  await db.expenses.bulkAdd(seedItems);
  return true;
}

/**
 * Data Backup: Export to JSON
 */
export async function exportExpensesToJson(): Promise<string> {
  const all = await db.expenses.toArray();
  const payload = {
    app: 'Expense Tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    totalCount: all.length,
    expenses: all,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Data Backup: Export to CSV
 */
export async function exportExpensesToCsv(): Promise<string> {
  const all = await db.expenses.orderBy('createdAt').reverse().toArray();
  const headers = ['ID', 'Date', 'Time', 'Merchant', 'Amount', 'Currency', 'Category', 'Note', 'Source', 'ProofLine'];
  
  const escapeCsv = (str?: string | number | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = all.map((exp) => {
    const d = new Date(exp.createdAt);
    const dateStr = exp.receiptDate || d.toISOString().split('T')[0];
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return [
      exp.id ?? '',
      escapeCsv(dateStr),
      escapeCsv(timeStr),
      escapeCsv(exp.merchant || ''),
      exp.amount,
      escapeCsv(exp.currency),
      escapeCsv(exp.category),
      escapeCsv(exp.note || ''),
      escapeCsv(exp.source),
      escapeCsv(exp.totalLine || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Data Restore: Import from JSON
 */
export async function importExpensesFromJson(jsonString: string, mode: 'merge' | 'replace' = 'merge'): Promise<{ imported: number }> {
  const data = JSON.parse(jsonString);
  const items: Expense[] = Array.isArray(data) ? data : data.expenses;

  if (!Array.isArray(items)) {
    throw new Error('Invalid JSON format: missing expenses array');
  }

  if (mode === 'replace') {
    await db.expenses.clear();
  }

  // Remove existing auto-assigned IDs to avoid key collisions on merge
  const cleanItems = items.map((item) => {
    const { id, ...rest } = item;
    return {
      ...rest,
      amount: Number(rest.amount) || 0,
      currency: rest.currency || '₹',
      category: rest.category || 'Other',
      source: rest.source || 'typed',
      createdAt: rest.createdAt || new Date().toISOString(),
    } as Expense;
  });

  await db.expenses.bulkAdd(cleanItems);
  return { imported: cleanItems.length };
}
