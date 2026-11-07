import Dexie, { type Table } from 'dexie';
import { localDateStr, spendDate } from './lib/expenseQuery.ts';
import { FALLBACK_CURRENCY } from './lib/money.ts';

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
const SEED_FLAG = 'expense_seed_done';

/**
 * Seeds sample expenses on the very first run only. Without the flag, deleting every
 * expense would bring the samples back on the next load (and the voice agent would
 * answer with fake spending). Settings' "Reset Demo Data" passes force = true.
 */
export async function initializeSeedDataIfEmpty(currency = FALLBACK_CURRENCY, force = false): Promise<boolean> {
  let alreadySeeded = false;
  try {
    alreadySeeded = localStorage.getItem(SEED_FLAG) === '1';
  } catch {
    // storage unavailable: fall through to the count check
  }
  if (alreadySeeded && !force) return false;

  const count = await db.expenses.count();
  try {
    localStorage.setItem(SEED_FLAG, '1');
  } catch {
    // ignore
  }
  if (count > 0) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Sample data designed to showcase real month comparison and category breakdown
  // Current month expenses (November)
  // Sample data (UAE, in the chosen currency) to show the month comparison and category breakdown.
  // Item lines add up to each receipt total.
  const seedItems: Expense[] = [
    {
      amount: 31.5,
      currency,
      category: 'Food & Dining',
      merchant: 'Tim Hortons',
      note: 'Iced Capp and Timbits',
      createdAt: new Date(currentYear, currentMonth, now.getDate(), 9, 30).toISOString(),
      source: 'typed',
      receiptDate: localDateStr(new Date(currentYear, currentMonth, now.getDate())),
    },
    {
      amount: 245.75,
      currency,
      category: 'Groceries',
      merchant: 'Carrefour',
      note: 'Weekly groceries',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 1), 18, 45).toISOString(),
      source: 'scan',
      receiptDate: localDateStr(new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 1))),
      totalLine: 'TOTAL INCL. VAT  AED 245.75',
      items: [
        { name: 'Fresh Strawberries 500g', amount: 24.5 },
        { name: 'Almarai Laban 2L', amount: 11.25 },
        { name: 'Basmati Rice 5kg', amount: 54.0 },
        { name: 'Chicken Breast 1kg', amount: 38.0 },
        { name: 'Olive Oil 1L', amount: 42.0 },
        { name: 'Medjool Dates 1kg', amount: 76.0 },
      ],
    },
    {
      amount: 38.0,
      currency,
      category: 'Transport',
      merchant: 'Careem',
      note: 'Ride to the metro',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 2), 8, 15).toISOString(),
      source: 'typed',
      receiptDate: localDateStr(new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 2))),
    },
    {
      amount: 189.0,
      currency,
      category: 'Shopping',
      merchant: 'H&M',
      note: 'T-shirt and socks',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 3), 16, 20).toISOString(),
      source: 'scan',
      receiptDate: localDateStr(new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 3))),
      totalLine: 'TOTAL AED 189.00',
      items: [
        { name: 'Regular Fit T-shirt', amount: 99.0 },
        { name: 'Socks 5-pack', amount: 90.0 },
      ],
    },
    {
      amount: 412.6,
      currency,
      category: 'Bills & Utilities',
      merchant: 'DEWA',
      note: 'Electricity and water bill',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 4), 11, 0).toISOString(),
      source: 'typed',
      receiptDate: localDateStr(new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 4))),
    },
    {
      amount: 64.25,
      currency,
      category: 'Health',
      merchant: 'Aster Pharmacy',
      note: 'Vitamins and throat lozenges',
      createdAt: new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 5), 20, 10).toISOString(),
      source: 'scan',
      receiptDate: localDateStr(new Date(currentYear, currentMonth, Math.max(1, now.getDate() - 5))),
      totalLine: 'NET AMOUNT  AED 64.25',
      items: [
        { name: 'Vitamin C 1000mg', amount: 42.0 },
        { name: 'Strepsils Honey Lemon', amount: 22.25 },
      ],
    },

    // Prior month entries to compare against
    {
      amount: 58.0,
      currency,
      category: 'Food & Dining',
      merchant: 'Shake Shack',
      note: 'Quick lunch',
      createdAt: new Date(currentYear, currentMonth - 1, 2, 13, 0).toISOString(),
      source: 'typed',
      receiptDate: localDateStr(new Date(currentYear, currentMonth - 1, 2)),
    },
    {
      amount: 312.4,
      currency,
      category: 'Groceries',
      merchant: 'Spinneys',
      note: 'Pantry restock',
      createdAt: new Date(currentYear, currentMonth - 1, 4, 17, 30).toISOString(),
      source: 'typed',
      receiptDate: localDateStr(new Date(currentYear, currentMonth - 1, 4)),
    },
    {
      amount: 96.0,
      currency,
      category: 'Transport',
      merchant: 'Dubai Taxi',
      note: 'Airport drop, Terminal 3',
      createdAt: new Date(currentYear, currentMonth - 1, 5, 6, 0).toISOString(),
      source: 'scan',
      receiptDate: localDateStr(new Date(currentYear, currentMonth - 1, 5)),
      totalLine: 'TOTAL FARE  AED 96.00',
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
    const dateStr = spendDate(exp);
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
      currency: rest.currency || FALLBACK_CURRENCY,
      category: rest.category || 'Other',
      source: rest.source || 'typed',
      createdAt: rest.createdAt || new Date().toISOString(),
    } as Expense;
  });

  await db.expenses.bulkAdd(cleanItems);
  return { imported: cleanItems.length };
}
