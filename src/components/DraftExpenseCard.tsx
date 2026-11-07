import React, { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { CATEGORIES } from '../lib/categories.ts';
import { formatMoney } from '../lib/money.ts';
import { CategoryChip } from './CategoryChip.tsx';

export interface DraftExpense {
  amount: number;
  category: string;
  merchant: string;
  note: string;
  date: string; // YYYY-MM-DD
}

export type DraftState = 'pending' | 'saving' | 'saved' | 'discarded';

interface DraftExpenseCardProps {
  draft: DraftExpense;
  state: DraftState;
  currency: string;
  today: string;
  onSave: (draft: DraftExpense) => void;
  onDiscard: () => void;
}

/**
 * The expense the voice agent heard, waiting for the user's OK.
 * Nothing is stored until Save is tapped.
 */
export const DraftExpenseCard: React.FC<DraftExpenseCardProps> = ({
  draft,
  state,
  currency,
  today,
  onSave,
  onDiscard,
}) => {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(draft.amount));
  const [merchant, setMerchant] = useState(draft.merchant);
  const [note, setNote] = useState(draft.note);
  const [category, setCategory] = useState(draft.category);
  const [date, setDate] = useState(draft.date);

  const parsedAmount = Math.round(parseFloat(amount) * 100) / 100;
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const current: DraftExpense = {
    amount: amountValid ? parsedAmount : draft.amount,
    merchant: merchant.trim(),
    note: note.trim(),
    category,
    date: date && date <= today ? date : today,
  };
  const money = formatMoney(current.amount, currency);
  const dateLabel =
    current.date === today
      ? 'Today'
      : new Date(`${current.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  if (state === 'saved') {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-[#2f7a45] dark:text-[#48a665]">
        <Check className="w-4 h-4" aria-hidden="true" />
        <span>
          Saved {money.full}
          {current.merchant ? ` at ${current.merchant}` : ''}
        </span>
      </p>
    );
  }

  if (state === 'discarded') {
    return <p className="mt-3 text-sm text-[#5c6064] dark:text-[#9ca1a8]">Not saved.</p>;
  }

  const inputClass =
    'w-full h-10 px-3 rounded-[10px] bg-white dark:bg-[#111214] border border-[#d6d9dd] dark:border-[#3a3d42] text-[15px] text-[#1b1d1f] dark:text-[#f3f5f7] focus:outline-none focus:ring-2 focus:ring-[#1d5fd6]';

  return (
    <div
      className="mt-3 rounded-[16px] bg-[#f2f8fd] dark:bg-[#222428] p-4"
      role="group"
      aria-label="Expense ready to save"
    >
      {!editing ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] truncate">
              {current.merchant || current.note || current.category}
            </span>
            <span className="text-[24px] font-semibold tabular-nums text-[#1b1d1f] dark:text-[#f3f5f7] shrink-0">
              {money.whole}
              <span className="text-[16px] text-[#5c6064] dark:text-[#9ca1a8]">{money.decimal}</span>
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[13px] text-[#5c6064] dark:text-[#9ca1a8]">
            <CategoryChip category={current.category} />
            <span aria-hidden="true">·</span>
            <span>{dateLabel}</span>
            {current.note && current.merchant && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{current.note}</span>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium mb-2 text-[#1b1d1f] dark:text-[#f3f5f7]">Amount</span>
              <input
                className={`${inputClass} tabular-nums`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!amountValid}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-2 text-[#1b1d1f] dark:text-[#f3f5f7]">Date</span>
              <input className={inputClass} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-2 text-[#1b1d1f] dark:text-[#f3f5f7]">Store</span>
            <input className={inputClass} value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-2 text-[#1b1d1f] dark:text-[#f3f5f7]">Note</span>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div>
            <span className="block text-sm font-medium mb-2 text-[#1b1d1f] dark:text-[#f3f5f7]">Category</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <CategoryChip
                  key={c.name}
                  category={c.name}
                  size="md"
                  isSelected={category === c.name}
                  onClick={() => setCategory(c.name)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSave(current)}
          disabled={state === 'saving' || !amountValid}
          className="h-11 px-4 rounded-full bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] text-sm font-semibold flex items-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-60 cursor-pointer"
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="h-11 px-3.5 rounded-full bg-[#e5e8ec] dark:bg-[#2c2f35] text-[#1b1d1f] dark:text-[#f3f5f7] text-sm font-semibold flex items-center gap-2 active:scale-[0.97] transition-transform cursor-pointer"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
          {editing ? 'Done' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="h-11 px-3 rounded-full text-[#5c6064] dark:text-[#9ca1a8] text-sm font-semibold flex items-center gap-2 hover:text-[#1b1d1f] dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          Discard
        </button>
      </div>
    </div>
  );
};
