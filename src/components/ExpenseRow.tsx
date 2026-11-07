import React from 'react';
import type { Expense } from '../db.ts';
import { formatMoney } from '../lib/money.ts';
import { CategoryChip } from './CategoryChip.tsx';
import { Camera } from 'lucide-react';

interface ExpenseRowProps {
  expense: Expense;
  currency: string;
  onClick: (expense: Expense) => void;
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({
  expense,
  currency,
  onClick,
}) => {
  const formatted = formatMoney(expense.amount, currency);
  
  // Format time (e.g. 2:15 PM)
  const d = new Date(expense.createdAt);
  const timeStr = isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const primaryTitle = expense.merchant || expense.note || expense.category || 'Expense';
  const hasDistinctNote = expense.merchant && expense.note && expense.merchant !== expense.note;

  return (
    <button
      type="button"
      onClick={() => onClick(expense)}
      className="w-full min-h-[72px] px-4 py-3 flex flex-col justify-center text-left bg-white dark:bg-[#1a1b1e] hover:bg-slate-50 dark:hover:bg-[#222428] transition-colors border-b border-[#f0f0f0] dark:border-[#27292d] last:border-b-0 active:bg-slate-100 dark:active:bg-[#282a30]"
      aria-label={`Expense: ${primaryTitle}, amount ${formatted.full}`}
    >
      {/* Line 1: Merchant / Note on left, amount on right */}
      <div className="w-full flex items-center justify-between gap-3">
        <span className="text-[16px] font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] truncate">
          {primaryTitle}
        </span>
        <span className="text-[17px] font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums shrink-0">
          <span>{formatted.whole}</span>
          <span className="text-[#5c6064] dark:text-[#9ca1a8] text-sm">{formatted.decimal}</span>
        </span>
      </div>

      {/* Line 2: Category chip, time, and "Scanned" badge in grey 14px */}
      <div className="w-full flex items-center gap-2.5 mt-1.5 text-[13px] text-[#5c6064] dark:text-[#9ca1a8]">
        <CategoryChip category={expense.category} size="sm" />
        
        {timeStr && (
          <>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>{timeStr}</span>
          </>
        )}

        {expense.source === 'scan' && (
          <>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              <Camera className="w-3 h-3" />
              <span>Scanned</span>
            </span>
          </>
        )}

        {hasDistinctNote && (
          <>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="truncate max-w-[120px] text-xs text-slate-400 dark:text-slate-500">
              {expense.note}
            </span>
          </>
        )}
      </div>
    </button>
  );
};
