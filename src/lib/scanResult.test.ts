import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateScanResult } from './scanResult.ts';

test('validates complete Gemini receipt reply', () => {
  const completeReply = {
    merchant: 'Starbucks Coffee',
    total: 1240.5,
    currency: '₹',
    date: '2026-11-05',
    category: 'Food & Dining',
    total_line: 'GRAND TOTAL  1,240.50',
    items: [
      { name: 'Caffe Latte', amount: 350.0 },
      { name: 'Croissant', amount: 280.0 },
      { name: 'Sandwich', amount: 610.5 },
    ],
  };

  const result = parseAndValidateScanResult(completeReply, '₹', new Date('2026-11-07'));
  assert.ok(result);
  assert.equal(result.merchant, 'Starbucks Coffee');
  assert.equal(result.total, 1240.5);
  assert.equal(result.currency, '₹');
  assert.equal(result.date, '2026-11-05');
  assert.equal(result.category, 'Food & Dining');
  assert.equal(result.totalLine, 'GRAND TOTAL  1,240.50');
  assert.equal(result.items.length, 3);
  assert.equal(result.isComplete, true);
});

test('handles partial receipt missing merchant', () => {
  const partialReply = {
    merchant: null,
    total: 420.0,
    currency: '$',
    date: '2026-11-06',
    category: 'Groceries',
    total_line: 'Amount Due: $420.00',
    items: [],
  };

  const result = parseAndValidateScanResult(partialReply, '$', new Date('2026-11-07'));
  assert.ok(result);
  assert.equal(result.merchant, '');
  assert.equal(result.total, 420.0);
  assert.equal(result.category, 'Groceries');
  assert.equal(result.totalLine, 'Amount Due: $420.00');
  assert.equal(result.isComplete, false); // needs merchant
});

test('handles partial receipt missing total', () => {
  const partialReply = {
    merchant: 'Trader Joe\'s',
    total: null,
    currency: '$',
    date: '2026-11-04',
    category: 'Groceries',
    total_line: null,
  };

  const result = parseAndValidateScanResult(partialReply, '$', new Date('2026-11-07'));
  assert.ok(result);
  assert.equal(result.merchant, 'Trader Joe\'s');
  assert.equal(result.total, null);
  assert.equal(result.isComplete, false);
});

test('rejects non-receipt or unreadable reply', () => {
  const notAReceipt = {
    merchant: null,
    total: null,
    date: null,
    category: null,
    total_line: null,
  };

  const result = parseAndValidateScanResult(notAReceipt);
  assert.equal(result, null);
});

test('clamps future dates to current reference date', () => {
  const futureReceipt = {
    merchant: 'Airport Duty Free',
    total: 3500.0,
    currency: '₹',
    date: '2026-12-25', // future
    category: 'Travel',
    total_line: 'NET CHARGE: 3500.00',
  };

  const refDate = new Date('2026-11-07T10:00:00Z');
  const result = parseAndValidateScanResult(futureReceipt, '₹', refDate);
  assert.ok(result);
  assert.equal(result.date, '2026-11-07');
});

test('maps fuzzy category names to predefined 9 categories', () => {
  const receipt = {
    merchant: 'Uber Rides',
    total: 185.0,
    category: 'transport',
    total_line: 'Trip Total ₹185.00',
  };

  const result = parseAndValidateScanResult(receipt);
  assert.ok(result);
  assert.equal(result.category, 'Transport');
});

test('maps UAE dirham spellings to AED', () => {
  for (const cur of ['AED', 'Dhs', 'Dhs.', 'DH', 'د.إ']) {
    const r = parseAndValidateScanResult({ merchant: 'Carrefour', total: 245.75, currency: cur, category: 'Groceries' }, '$');
    assert.equal(r?.currency, 'AED', cur);
  }
});
