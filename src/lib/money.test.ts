import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, calculateMonthComparison, currencyPrefix, detectDefaultCurrency } from './money.ts';

test('formats positive amounts with tabular split', () => {
  const result = formatMoney(1240.5, '₹');
  assert.equal(result.symbol, '₹');
  assert.equal(result.whole, '₹1,240');
  assert.equal(result.decimal, '.50');
  assert.equal(result.full, '₹1,240.50');
});

test('formats zero and integers with .00 decimals', () => {
  const zero = formatMoney(0, '₹');
  assert.equal(zero.whole, '₹0');
  assert.equal(zero.decimal, '.00');

  const integer = formatMoney(500, '$');
  assert.equal(integer.whole, '$500');
  assert.equal(integer.decimal, '.00');
});

test('calculates month-over-month comparison accurately', () => {
  const refDate = new Date('2026-11-07T12:00:00Z');

  // Current month (November, 7 days): total = 10,000
  const currentMonthExpenses = [
    { amount: 4000, createdAt: '2026-11-02T10:00:00Z' },
    { amount: 6000, createdAt: '2026-11-05T14:00:00Z' },
  ];

  // Last month (October):
  // Day <= 7: 3,000 + 4,860 = 7,860
  // Day > 7 (ignored for comparison): 5,000
  const lastMonthExpenses = [
    { amount: 3000, createdAt: '2026-10-03T10:00:00Z' },
    { amount: 4860, createdAt: '2026-10-06T12:00:00Z' },
    { amount: 5000, createdAt: '2026-10-20T12:00:00Z' }, // after day 7
  ];

  // Delta: 10,000 - 7,860 = +2,140
  const comp = calculateMonthComparison(currentMonthExpenses, lastMonthExpenses, '₹', refDate);
  assert.equal(comp.isHigher, true);
  assert.equal(comp.delta, 2140);
  assert.equal(comp.text, '₹2,140.00 more than by this day in October');
});

test('handles first month tracking with no previous records', () => {
  const comp = calculateMonthComparison(
    [{ amount: 500, createdAt: '2026-11-01T10:00:00Z' }],
    [],
    '₹',
    new Date('2026-11-07')
  );
  assert.equal(comp.text, 'First recorded month of spending');
  assert.equal(comp.delta, 0);
});

test('letter symbols get a space, sign symbols do not', () => {
  assert.equal(formatMoney(1240.5, 'AED').full, 'AED 1,240.50');
  assert.equal(formatMoney(-38, 'AED').whole, '-AED 38');
  assert.equal(currencyPrefix('AED'), 'AED ');
  assert.equal(currencyPrefix('₹'), '₹');
  assert.equal(currencyPrefix('CA$'), 'CA$');
});

test('default currency follows the device region and time zone', () => {
  assert.equal(detectDefaultCurrency('en-US', 'Asia/Dubai'), 'AED');
  assert.equal(detectDefaultCurrency('ar-AE', 'UTC'), 'AED');
  assert.equal(detectDefaultCurrency('en-IN', 'UTC'), '₹');
  assert.equal(detectDefaultCurrency('en-GB', 'Europe/London'), '£');
  assert.equal(detectDefaultCurrency('de-DE', 'Europe/Berlin'), '€');
  assert.equal(detectDefaultCurrency('xx', 'UTC'), 'AED');
});
