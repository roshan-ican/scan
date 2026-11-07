import React, { useState } from 'react';
import type { Expense } from '../db.ts';
import { CATEGORIES } from '../lib/categories.ts';
import { formatMoney } from '../lib/money.ts';
import { CategoryChip } from './CategoryChip.tsx';
import { X, Trash2, Calendar, Clock, Store, FileText } from 'lucide-react';

interface ExpenseEditModalProps {
  expense: Expense;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Expense) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const ExpenseEditModal: React.FC<ExpenseEditModalProps> = ({
  expense,
  currency,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen) return null;

  const [amount, setAmount] = useState<string>(String(expense.amount));
  const [merchant, setMerchant] = useState<string>(expense.merchant || '');
  const [note, setNote] = useState<string>(expense.note || '');
  const [category, setCategory] = useState<string>(expense.category);
  
  // Parse date and time from createdAt
  const expenseDate = new Date(expense.createdAt);
  const initialDateStr = !isNaN(expenseDate.getTime())
    ? expenseDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const initialTimeStr = !isNaN(expenseDate.getTime())
    ? expenseDate.toTimeString().slice(0, 5)
    : '12:00';

  const [dateStr, setDateStr] = useState<string>(initialDateStr);
  const [timeStr, setTimeStr] = useState<string>(initialTimeStr);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;

    // Combine dateStr and timeStr into ISO
    const combinedDate = new Date(`${dateStr}T${timeStr}:00`);

    const updated: Expense = {
      ...expense,
      amount: Math.round(num * 100) / 100,
      merchant: merchant.trim() || undefined,
      note: note.trim() || undefined,
      category,
      createdAt: !isNaN(combinedDate.getTime()) ? combinedDate.toISOString() : expense.createdAt,
      receiptDate: dateStr,
    };

    await onSave(updated);
    onClose();
  };

  const handleDeleteConfirmed = async () => {
    if (!expense.id) return;
    setIsDeleting(true);
    await onDelete(expense.id);
    setIsDeleting(false);
    onClose();
  };

  const displayName = expense.merchant || expense.note || expense.category || 'this expense';
  const displayFormatted = formatMoney(expense.amount, currency).full;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-[#1a1b1e] rounded-t-[24px] sm:rounded-[20px] max-h-[90vh] overflow-y-auto border border-[#e6e6e6] dark:border-[#2c2e33] p-5 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e6e6e6] dark:border-[#2c2e33]">
          <h2 className="text-lg font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
            Edit Expense
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full text-[#5c6064] dark:text-[#9ca1a8] hover:bg-slate-100 dark:hover:bg-[#25282d]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 mt-4">
          {/* Amount Field */}
          <div>
            <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
              Amount ({currency})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-[#5c6064] dark:text-[#9ca1a8]">
                {currency}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full h-12 pl-9 pr-3 text-xl font-bold rounded-[10px] bg-[#f3f5f7] dark:bg-[#111214] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7] focus:outline-hidden focus:ring-2 focus:ring-blue-600 tabular-nums"
              />
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
              Merchant / Store
            </label>
            <div className="relative">
              <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
              <input
                type="text"
                placeholder="e.g. Starbucks, Metro, Apple"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full h-11 pl-10 pr-3 text-sm rounded-[10px] bg-[#f3f5f7] dark:bg-[#111214] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7] focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <CategoryChip
                  key={cat.name}
                  category={cat.name}
                  isSelected={category === cat.name}
                  onClick={() => setCategory(cat.name)}
                />
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
              Note (optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
              <textarea
                rows={2}
                placeholder="Add details, items, or context"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full py-2 pl-10 pr-3 text-sm rounded-[10px] bg-[#f3f5f7] dark:bg-[#111214] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7] focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full h-10 pl-9 pr-2 text-xs rounded-[10px] bg-[#f3f5f7] dark:bg-[#111214] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
                Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full h-10 pl-9 pr-2 text-xs rounded-[10px] bg-[#f3f5f7] dark:bg-[#111214] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7]"
                />
              </div>
            </div>
          </div>

          {/* Receipt Proof (if source was scan) */}
          {expense.totalLine && (
            <div className="p-3 bg-[#f2f8fd] dark:bg-[#1e2329] rounded-[10px] border border-[#d0e4f7] dark:border-[#2b3947]">
              <span className="block text-[11px] font-semibold text-[#1d5fd6] dark:text-[#7bb0ff] uppercase tracking-wide mb-0.5">
                Receipt Proof Line
              </span>
              <p className="font-mono text-xs text-[#1b1d1f] dark:text-[#f3f5f7]">
                {expense.totalLine}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="flex-1 h-12 rounded-[10px] bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-12 rounded-[10px] bg-[#f3f5f7] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] text-sm font-medium hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Delete section at end */}
          <div className="pt-4 mt-2 border-t border-[#e6e6e6] dark:border-[#2c2e33]">
            {!showConfirmDelete ? (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="w-full py-2 flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-950/20 rounded-[10px] transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Expense</span>
              </button>
            ) : (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-[10px]">
                <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-2">
                  Delete {displayFormatted} at {displayName}?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteConfirmed}
                    disabled={isDeleting}
                    className="flex-1 py-2 rounded-[8px] bg-red-600 text-white text-xs font-semibold hover:bg-red-700 active:scale-95 transition-all cursor-pointer"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    className="px-3 py-2 rounded-[8px] bg-white dark:bg-[#25282d] text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
