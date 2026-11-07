/**
 * Shared, pure expense query engine.
 *
 * Used by:
 * - the phone, to compute Home's totals and to build the compact rows sent with a question;
 * - the server's /api/ask tool loop, to answer Gemini's `query_expenses` calls exactly.
 *
 * Gemini never does arithmetic itself: every figure it speaks comes from `queryExpenses`,
 * so the voice agent and the Home screen always agree.
 */

/** Compact row sent from the phone: [id, spendDate (YYYY-MM-DD local), amount, category, merchant, note, source] */
export type ExpenseRowTuple = [number, string, number, string, string, string, 'typed' | 'scan'];

export type GroupBy = 'category' | 'merchant' | 'day' | 'month' | 'none';

export interface QueryArgs {
  /** Inclusive start date, YYYY-MM-DD */
  from?: string;
  /** Inclusive end date, YYYY-MM-DD */
  to?: string;
  category?: string;
  /** Case-insensitive substring match on merchant */
  merchant?: string;
  /** Case-insensitive substring match on merchant or note */
  text?: string;
  groupBy?: GroupBy;
  /** How many individual expenses to return (default 5, max 50) */
  limit?: number;
  /** Order of the returned expenses: largest first (default) or most recent first */
  sort?: 'amount' | 'date';
}

export interface QueryItem {
  id: number;
  date: string;
  amount: number;
  category: string;
  merchant: string;
  note: string;
}

export interface QueryGroup {
  key: string;
  total: number;
  count: number;
}

export interface QueryResult {
  from: string | null;
  to: string | null;
  count: number;
  total: number;
  average: number;
  groups: QueryGroup[];
  items: QueryItem[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** YYYY-MM-DD of a Date in the device's local timezone (not UTC). */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The day an expense counts towards: the date printed on the receipt when there is one,
 * otherwise the local date it was recorded.
 */
export function spendDate(e: { receiptDate?: string; createdAt: string }): string {
  if (e.receiptDate && DATE_RE.test(e.receiptDate)) return e.receiptDate;
  const d = new Date(e.createdAt);
  return isNaN(d.getTime()) ? '' : localDateStr(d);
}

/** YYYY-MM of a YYYY-MM-DD string. */
export const monthKey = (date: string) => date.slice(0, 7);

export function toRows(
  expenses: Array<{
    id?: number;
    amount: number;
    category: string;
    merchant?: string;
    note?: string;
    source: 'typed' | 'scan';
    receiptDate?: string;
    createdAt: string;
  }>
): ExpenseRowTuple[] {
  return expenses.map((e) => [
    e.id ?? 0,
    spendDate(e),
    round2(Number(e.amount) || 0),
    e.category || 'Other',
    e.merchant || '',
    e.note || '',
    e.source,
  ]);
}

export function queryExpenses(rows: ExpenseRowTuple[], args: QueryArgs = {}): QueryResult {
  const from = args.from && DATE_RE.test(args.from) ? args.from : null;
  const to = args.to && DATE_RE.test(args.to) ? args.to : null;
  const category = args.category?.trim().toLowerCase() || '';
  const merchant = args.merchant?.trim().toLowerCase() || '';
  const text = args.text?.trim().toLowerCase() || '';
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 5), 0), 50);

  const matched = rows.filter(([, date, , cat, merch, note]) => {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    if (category && cat.toLowerCase() !== category) return false;
    if (merchant && !merch.toLowerCase().includes(merchant)) return false;
    if (text && !`${merch} ${note}`.toLowerCase().includes(text)) return false;
    return true;
  });

  // Sum in integer paise/cents so totals never drift.
  const totalCents = matched.reduce((acc, r) => acc + Math.round(r[2] * 100), 0);
  const total = totalCents / 100;

  let groups: QueryGroup[] = [];
  const groupBy = args.groupBy ?? 'none';
  if (groupBy !== 'none') {
    const map = new Map<string, { cents: number; count: number }>();
    for (const r of matched) {
      const key =
        groupBy === 'category'
          ? r[3]
          : groupBy === 'merchant'
            ? r[4] || '(no store)'
            : groupBy === 'day'
              ? r[1]
              : monthKey(r[1]);
      const g = map.get(key) ?? { cents: 0, count: 0 };
      g.cents += Math.round(r[2] * 100);
      g.count += 1;
      map.set(key, g);
    }
    groups = Array.from(map.entries()).map(([key, g]) => ({ key, total: g.cents / 100, count: g.count }));
    if (groupBy === 'day' || groupBy === 'month') {
      groups.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      groups.sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
    }
  }

  const sorted = [...matched].sort((a, b) =>
    args.sort === 'date' ? b[1].localeCompare(a[1]) || b[0] - a[0] : b[2] - a[2] || b[1].localeCompare(a[1])
  );

  const items: QueryItem[] = sorted.slice(0, limit).map(([id, date, amount, cat, merch, note]) => ({
    id,
    date,
    amount,
    category: cat,
    merchant: merch,
    note,
  }));

  return {
    from,
    to,
    count: matched.length,
    total,
    average: matched.length ? round2(total / matched.length) : 0,
    groups,
    items,
  };
}
