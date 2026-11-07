import React, { useState } from 'react';
import type { Expense } from '../db.ts';
import { CATEGORIES } from '../lib/categories.ts';
import { Keypad } from '../components/Keypad.tsx';
import { CategoryChip } from '../components/CategoryChip.tsx';
import { ArrowLeft, Clock, Calendar, Check, Store } from 'lucide-react';

interface AddExpenseScreenProps {
  currency: string;
  onSave: (expense: Omit<Expense, 'id'>) => Promise<void>;
  onCancel: () => void;
}

export const AddExpenseScreen: React.FC<AddExpenseScreenProps> = ({
  currency,
  onSave,
  onCancel,
}) => {
  // Amount keypad state (stored as string like "0", "12.50")
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Time & Date state (defaults to now)
  const now = new Date();
  const [dateStr, setDateStr] = useState<string>(now.toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState<string>(now.toTimeString().slice(0, 5));
  const [showAdvancedTime, setShowAdvancedTime] = useState<boolean>(false);

  // Keypad Handlers
  const handleDigit = (digit: string) => {
    if (amountStr === '0') {
      setAmountStr(digit);
    } else {
      // Check maximum 2 decimal places if dot is present
      if (amountStr.includes('.')) {
        const parts = amountStr.split('.');
        if (parts[1].length >= 2) return; // don't add more than 2 decimals
      }
      // Check length limits
      if (amountStr.length >= 8) return;
      setAmountStr(amountStr + digit);
    }
  };

  const handleDecimal = () => {
    if (!amountStr.includes('.')) {
      setAmountStr(amountStr + '.');
    }
  };

  const handleBackspace = () => {
    if (amountStr.length <= 1) {
      setAmountStr('0');
    } else {
      setAmountStr(amountStr.slice(0, -1));
    }
  };

  // Category toggle: tapping the selected chip unselects it
  const handleCategoryClick = (catName: string) => {
    if (selectedCategory === catName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(catName);
    }
  };

  // Submit
  const handleSave = async () => {
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    setIsSaving(true);
    try {
      const combinedDateTime = new Date(`${dateStr}T${timeStr}:00`);
      const createdAt = !isNaN(combinedDateTime.getTime())
        ? combinedDateTime.toISOString()
        : new Date().toISOString();

      await onSave({
        amount: Math.round(numericAmount * 100) / 100,
        currency,
        category: selectedCategory || 'Other',
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        createdAt,
        receiptDate: dateStr,
        source: 'typed',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const numericVal = parseFloat(amountStr) || 0;
  const canSave = numericVal > 0 && !isSaving;

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-3 pb-24 md:pb-10 flex flex-col justify-between min-h-[calc(100vh-80px)]">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 -ml-2 rounded-full text-[#5c6064] dark:text-[#9ca1a8] hover:bg-slate-100 dark:hover:bg-[#25282d] transition-colors cursor-pointer"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-[#5c6064] dark:text-[#9ca1a8] uppercase tracking-wider">
            Type Expense
          </span>
          <div className="w-8" />
        </div>

        {/* Question: "How much, on what?" */}
        <div className="text-center my-3">
          <p className="text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
            How much, on what?
          </p>

          {/* Amount Display at 32px tabular digits */}
          <div className="inline-flex items-baseline justify-center text-[40px] md:text-[44px] font-bold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums tracking-tight">
            <span className="text-2xl text-[#5c6064] dark:text-[#9ca1a8] mr-1">{currency}</span>
            <span>{amountStr}</span>
          </div>
        </div>

        {/* Row of Category Chips (optional, horizontally scrollable) */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[#5c6064] dark:text-[#9ca1a8] mb-1.5 px-1">
            <span>Category (optional)</span>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none py-1">
            {CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat.name}
                category={cat.name}
                isSelected={selectedCategory === cat.name}
                onClick={() => handleCategoryClick(cat.name)}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* Merchant & Note Inputs */}
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
            <input
              type="text"
              placeholder="Store or place (e.g. Starbucks, Metro)"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full h-11 pl-9 pr-3 text-sm rounded-[10px] bg-white dark:bg-[#1a1b1e] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7] placeholder-[#9ca1a8] focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-11 px-3 text-sm rounded-[10px] bg-white dark:bg-[#1a1b1e] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7] placeholder-[#9ca1a8] focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Time selection disclosure */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowAdvancedTime(!showAdvancedTime)}
            className="text-xs text-[#5c6064] dark:text-[#9ca1a8] hover:text-[#1b1d1f] dark:hover:text-white flex items-center gap-1.5 cursor-pointer py-1"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              Time: {dateStr === now.toISOString().split('T')[0] ? 'Today' : dateStr} at {timeStr}
            </span>
            <span className="text-[11px] underline ml-1">Change</span>
          </button>

          {showAdvancedTime && (
            <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-white dark:bg-[#1a1b1e] rounded-[10px] border border-[#e6e6e6] dark:border-[#2c2e33]">
              <div>
                <label className="block text-[11px] text-[#5c6064] dark:text-[#9ca1a8] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-lg bg-[#f3f5f7] dark:bg-[#111214] text-[#1b1d1f] dark:text-[#f3f5f7]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#5c6064] dark:text-[#9ca1a8] mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-lg bg-[#f3f5f7] dark:bg-[#111214] text-[#1b1d1f] dark:text-[#f3f5f7]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Keypad & Save Button */}
      <div className="space-y-3">
        <Keypad
          onDigit={handleDigit}
          onDecimal={handleDecimal}
          onBackspace={handleBackspace}
        />

        {/* Full-width near-black Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`w-full h-13 rounded-[12px] font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            canSave
              ? 'bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] hover:opacity-90 active:scale-[0.98] shadow-sm'
              : 'bg-slate-200 dark:bg-[#25282d] text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : `Save ${currency}${amountStr}`}</span>
        </button>
      </div>
    </div>
  );
};
