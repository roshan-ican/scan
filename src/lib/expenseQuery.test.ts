// Run in India time so the "before 05:30" UTC/local boundary is exercised.
process.env.TZ = 'Asia/Kolkata';

import test from 'node:test';
import assert from 'node:assert/strict';
import { queryExpenses, spendDate, toRows, localDateStr, type ExpenseRowTuple } from './expenseQuery.ts';

const rows: ExpenseRowTuple[] = [
  [1, '2026-11-07', 450, 'Food & Dining', 'Third Wave Coffee', 'Pour-over', 'typed'],
  [2, '2026-11-06', 1240, 'Groceries', "Nature's Basket", 'Weekly', 'scan'],
  [3, '2026-11-05', 280, 'Transport', 'Uber Auto', 'Metro', 'typed'],
  [4, '2026-11-01', 0.1, 'Food & Dining', 'Subway', '', 'typed'],
  [5, '2026-11-01', 0.2, 'Food & Dining', 'Subway', 'lunch', 'typed'],
  [6, '2026-10-31', 650, 'Food & Dining', 'Subway', 'Quick lunch', 'typed'],
  [7, '2026-10-04', 980, 'Groceries', 'Blinkit', 'Pantry', 'typed'],
];

test('totals a month with inclusive boundaries', () => {
  const nov = queryExpenses(rows, { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(nov.count, 5);
  assert.equal(nov.total, 1970.3);

  const oct = queryExpenses(rows, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(oct.count, 2);
  assert.equal(oct.total, 1630);
});

test('sums without floating point drift', () => {
  const r = queryExpenses(rows, { from: '2026-11-01', to: '2026-11-01' });
  assert.equal(r.total, 0.3);
});

test('filters by category case-insensitively and groups by category', () => {
  const food = queryExpenses(rows, { category: 'food & dining', from: '2026-11-01', to: '2026-11-30' });
  assert.equal(food.count, 3);
  assert.equal(food.total, 450.3);

  const byCat = queryExpenses(rows, { from: '2026-11-01', to: '2026-11-30', groupBy: 'category' });
  assert.deepEqual(
    byCat.groups.map((g) => [g.key, g.total, g.count]),
    [
      ['Groceries', 1240, 1],
      ['Food & Dining', 450.3, 3],
      ['Transport', 280, 1],
    ]
  );
});

test('groups by month in date order', () => {
  const r = queryExpenses(rows, { groupBy: 'month' });
  assert.deepEqual(
    r.groups.map((g) => [g.key, g.total]),
    [
      ['2026-10', 1630],
      ['2026-11', 1970.3],
    ]
  );
});

test('matches merchant and free text', () => {
  assert.equal(queryExpenses(rows, { merchant: 'subway' }).count, 3);
  assert.equal(queryExpenses(rows, { text: 'lunch' }).count, 2);
});

test('returns the largest expenses first, limited', () => {
  const r = queryExpenses(rows, { limit: 2 });
  assert.deepEqual(r.items.map((i) => i.id), [2, 7]);
  const recent = queryExpenses(rows, { limit: 2, sort: 'date' });
  assert.deepEqual(recent.items.map((i) => i.id), [1, 2]);
});

test('empty result is an honest zero', () => {
  const r = queryExpenses(rows, { category: 'Travel' });
  assert.equal(r.count, 0);
  assert.equal(r.total, 0);
  assert.equal(r.average, 0);
  assert.deepEqual(r.items, []);
});

test('spendDate prefers the receipt date, else the LOCAL day it was recorded', () => {
  // 2026-11-07 03:00 in India is still 2026-11-06 in UTC.
  const earlyMorning = new Date(2026, 10, 7, 3, 0).toISOString();
  assert.equal(earlyMorning.slice(0, 10), '2026-11-06');
  assert.equal(spendDate({ createdAt: earlyMorning }), '2026-11-07');
  assert.equal(spendDate({ createdAt: earlyMorning, receiptDate: '2026-11-02' }), '2026-11-02');
  assert.equal(localDateStr(new Date(2026, 0, 5)), '2026-01-05');
});

test('toRows builds compact tuples', () => {
  const [row] = toRows([
    { id: 9, amount: 99.999, category: 'Health', source: 'scan', createdAt: new Date(2026, 10, 7, 12).toISOString() },
  ]);
  assert.deepEqual(row, [9, '2026-11-07', 100, 'Health', '', '', 'scan']);
});
