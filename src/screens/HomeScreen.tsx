import React from 'react';
import type { Expense } from '../db.ts';
import { formatMoney, calculateMonthComparison } from '../lib/money.ts';
import { CategoryBarList } from '../components/CategoryBarList.tsx';
import { ExpenseRow } from '../components/ExpenseRow.tsx';
import { Camera, Plus, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

interface HomeScreenProps {
  expenses: Expense[];
  currency: string;
  onNavigateToAdd: () => void;
  onNavigateToScan: () => void;
  onNavigateToHistory: () => void;
  onSelectExpense: (expense: Expense) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  expenses,
  currency,
  onNavigateToAdd,
  onNavigateToScan,
  onNavigateToHistory,
  onSelectExpense,
}) => {
  const now = new Date();
  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayStr = now.toISOString().split('T')[0];

  // Current month expenses
  const currentMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.createdAt);
    return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  // Prior month expenses
  const priorMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const priorYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const priorMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.createdAt);
    return !isNaN(d.getTime()) && d.getFullYear() === priorYear && d.getMonth() === priorMonth;
  });

  // Month total
  const monthTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const formattedMonthTotal = formatMoney(monthTotal, currency);

  // Month comparison finding
  const comparison = calculateMonthComparison(
    currentMonthExpenses,
    priorMonthExpenses,
    currency,
    now
  );

  // Today's total
  const todayExpenses = expenses.filter((e) => {
    const d = new Date(e.createdAt);
    const dateStr = e.receiptDate || (!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '');
    return dateStr === todayStr;
  });
  const todayTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const formattedTodayTotal = formatMoney(todayTotal, currency);

  // Category breakdown for current month, sorted largest first
  const categoryMap = new Map<string, number>();
  for (const exp of currentMonthExpenses) {
    const cat = exp.category || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + exp.amount);
  }

  const categorySpending = Array.from(categoryMap.entries())
    .map(([cat, amount]) => ({
      category: cat,
      total: amount,
      percentage: monthTotal > 0 ? Math.round((amount / monthTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Recent 5 expenses
  const recentExpenses = expenses.slice(0, 5);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-4 pb-28 md:pb-12">
      {/* Top Header */}
      <header className="flex items-baseline justify-between mb-5">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#1b1d1f] dark:text-[#f3f5f7] tracking-tight">
            {currentMonthName}
          </h1>
          <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-0.5">
            Personal Expense Tracker · {currentYear}
          </p>
        </div>

        {/* Small today badge in top right */}
        <div className="text-right">
          <span className="text-xs text-[#5c6064] dark:text-[#9ca1a8]">Today</span>
          <p className="text-sm font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums">
            {formattedTodayTotal.full}
          </p>
        </div>
      </header>

      {/* Grid: 2 columns on tablet/desktop, 1 column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column (Summary & Category Breakdown) */}
        <div className="md:col-span-6 lg:col-span-7 space-y-6">
          {/* Main Month Total Card */}
          <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-6 border border-[#e6e6e6] dark:border-[#2c2e33]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5c6064] dark:text-[#9ca1a8]">
              Total Spent in {currentMonthName}
            </span>

            {/* Largest figure on screen: 32px/600, paise/cents smaller in grey */}
            <div className="mt-2 flex items-baseline text-[36px] font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums tracking-tight">
              <span>{formattedMonthTotal.whole}</span>
              <span className="text-[#5c6064] dark:text-[#9ca1a8] text-[22px] ml-0.5">
                {formattedMonthTotal.decimal}
              </span>
            </div>

            {/* One-line finding underneath that names comparison */}
            <div className="mt-3 pt-3 border-t border-[#f0f0f0] dark:border-[#27292d] flex items-center gap-1.5 text-xs text-[#5c6064] dark:text-[#9ca1a8]">
              {comparison.delta !== 0 ? (
                comparison.isHigher ? (
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-[#2f7a45] dark:text-[#48a665] shrink-0" />
                )
              ) : null}
              <span>{comparison.text}</span>
            </div>
          </section>

          {/* Spending by Category Card */}
          <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-6 border border-[#e6e6e6] dark:border-[#2c2e33]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
                Spending by Category
              </h2>
              <span className="text-xs text-[#5c6064] dark:text-[#9ca1a8]">
                {categorySpending.length} active
              </span>
            </div>

            <CategoryBarList items={categorySpending} currency={currency} />
          </section>
        </div>

        {/* Right Column (Actions & Recent List) */}
        <div className="md:col-span-6 lg:col-span-5 space-y-6">
          {/* Quick Action Buttons (Within thumb reach) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Scan: Near-black filled */}
            <button
              type="button"
              onClick={onNavigateToScan}
              className="h-14 rounded-[14px] bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] flex items-center justify-center gap-2 font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              aria-label="Scan receipt with camera"
            >
              <Camera className="w-5 h-5" />
              <span>Scan Receipt</span>
            </button>

            {/* Type: Grey secondary */}
            <button
              type="button"
              onClick={onNavigateToAdd}
              className="h-14 rounded-[14px] bg-[#e8ebef] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] flex items-center justify-center gap-2 font-semibold text-sm hover:bg-[#dfe3e8] dark:hover:bg-[#2f3238] active:scale-[0.98] transition-all cursor-pointer"
              aria-label="Type expense manually"
            >
              <Plus className="w-5 h-5" />
              <span>Type Expense</span>
            </button>
          </div>

          {/* Recent Expenses List Card */}
          <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] overflow-hidden border border-[#e6e6e6] dark:border-[#2c2e33]">
            <div className="px-5 py-3.5 border-b border-[#e6e6e6] dark:border-[#2c2e33] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
                Recent Expenses
              </h2>
              <button
                type="button"
                onClick={onNavigateToHistory}
                className="text-xs font-semibold text-[#1d5fd6] dark:text-[#4b86f0] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5c6064] dark:text-[#9ca1a8]">
                <p>No expenses recorded yet.</p>
                <p className="text-xs mt-1 text-slate-400">
                  Tap Scan or Type to add your first expense.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#f0f0f0] dark:divide-[#27292d]">
                {recentExpenses.map((exp) => (
                  <ExpenseRow
                    key={exp.id || exp.createdAt}
                    expense={exp}
                    currency={currency}
                    onClick={onSelectExpense}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
