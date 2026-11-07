import React, { useState, useMemo } from 'react';
import type { Expense } from '../db.ts';
import { CATEGORIES } from '../lib/categories.ts';
import { formatMoney } from '../lib/money.ts';
import { ExpenseRow } from '../components/ExpenseRow.tsx';
import { CategoryChip } from '../components/CategoryChip.tsx';
import { Search, Filter, Calendar } from 'lucide-react';

interface HistoryScreenProps {
  expenses: Expense[];
  currency: string;
  onSelectExpense: (expense: Expense) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  expenses,
  currency,
  onSelectExpense,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filtered expenses
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      // Category filter
      if (selectedCategory && e.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const merchantMatch = e.merchant?.toLowerCase().includes(q);
        const noteMatch = e.note?.toLowerCase().includes(q);
        const categoryMatch = e.category?.toLowerCase().includes(q);
        const proofMatch = e.totalLine?.toLowerCase().includes(q);
        return Boolean(merchantMatch || noteMatch || categoryMatch || proofMatch);
      }
      return true;
    });
  }, [expenses, selectedCategory, searchQuery]);

  // Group by day (YYYY-MM-DD or formatted day label)
  const groupedByDay = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const map = new Map<string, { label: string; dateKey: string; items: Expense[]; total: number }>();

    for (const exp of filtered) {
      const d = new Date(exp.createdAt);
      const dateKey = exp.receiptDate || (!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : 'Other');

      let label = dateKey;
      if (dateKey === todayStr) {
        label = 'Today';
      } else if (dateKey === yesterdayStr) {
        label = 'Yesterday';
      } else if (dateKey !== 'Other' && !isNaN(d.getTime())) {
        label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      }

      if (!map.has(dateKey)) {
        map.set(dateKey, { label, dateKey, items: [], total: 0 });
      }
      const group = map.get(dateKey)!;
      group.items.push(exp);
      group.total += exp.amount;
    }

    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filtered]);

  const totalFilteredAmount = useMemo(() => {
    return filtered.reduce((sum, e) => sum + e.amount, 0);
  }, [filtered]);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-28 md:pb-12 space-y-4">
      {/* Header */}
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#1b1d1f] dark:text-[#f3f5f7] tracking-tight">
            History
          </h1>
          <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-0.5">
            Where did it go? · {filtered.length} expenses
          </p>
        </div>

        {/* Filtered sum summary */}
        <div className="text-right">
          <span className="text-[11px] text-[#5c6064] dark:text-[#9ca1a8]">Total</span>
          <p className="text-base font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums">
            {formatMoney(totalFilteredAmount, currency).full}
          </p>
        </div>
      </header>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
        <input
          type="text"
          placeholder="Search by store, note, or item..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pl-10 pr-3 text-sm rounded-[12px] bg-white dark:bg-[#1a1b1e] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7] placeholder-[#9ca1a8] focus:outline-hidden focus:ring-2 focus:ring-blue-600"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5c6064] dark:text-[#9ca1a8] hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Horizontal Category Filter Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none py-1">
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer ${
            selectedCategory === null
              ? 'bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f]'
              : 'bg-white dark:bg-[#1a1b1e] text-[#5c6064] dark:text-[#9ca1a8] border border-[#e6e6e6] dark:border-[#2c2e33]'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat.name}
            category={cat.name}
            isSelected={selectedCategory === cat.name}
            onClick={() => {
              if (selectedCategory === cat.name) {
                setSelectedCategory(null);
              } else {
                setSelectedCategory(cat.name);
              }
            }}
            size="sm"
            className="shrink-0"
          />
        ))}
      </div>

      {/* Grouped Days List */}
      {groupedByDay.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-[#e6e6e6] dark:border-[#2c2e33]">
          <Calendar className="w-8 h-8 mx-auto text-[#5c6064] dark:text-[#9ca1a8] mb-2 stroke-[1.5]" />
          <p className="text-sm font-medium text-[#1b1d1f] dark:text-[#f3f5f7]">
            No matching expenses found
          </p>
          <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-1">
            Try adjusting your search query or category filter.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map((group) => {
            const dayFormatted = formatMoney(group.total, currency);
            return (
              <section
                key={group.dateKey}
                className="bg-white dark:bg-[#1a1b1e] rounded-[20px] overflow-hidden border border-[#e6e6e6] dark:border-[#2c2e33]"
              >
                {/* Day Header with Right-Aligned Total */}
                <div className="px-4 py-3 bg-[#f8fafc] dark:bg-[#202226] border-b border-[#e6e6e6] dark:border-[#2c2e33] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
                    {group.label} · <span className="font-normal text-[#5c6064] dark:text-[#9ca1a8]">{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</span>
                  </span>
                  <span className="text-xs font-bold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums">
                    {dayFormatted.full}
                  </span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-[#f0f0f0] dark:divide-[#27292d]">
                  {group.items.map((exp) => (
                    <ExpenseRow
                      key={exp.id || exp.createdAt}
                      expense={exp}
                      currency={currency}
                      onClick={onSelectExpense}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
