import React from 'react';
import { formatMoney } from '../lib/money.ts';
import { getCategoryDef } from '../lib/categories.ts';

interface CategorySpending {
  category: string;
  total: number;
  percentage: number;
}

interface CategoryBarListProps {
  items: CategorySpending[];
  currency: string;
}

export const CategoryBarList: React.FC<CategoryBarListProps> = ({ items, currency }) => {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-[#5c6064] dark:text-[#9ca1a8]">
        No category spending recorded yet this month.
      </div>
    );
  }

  // Find max total to calculate bar widths proportional to highest category
  const maxTotal = items[0]?.total || 1;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cat = getCategoryDef(item.category);
        const barWidth = Math.max(6, Math.round((item.total / maxTotal) * 100));
        const formatted = formatMoney(item.total, currency);

        return (
          <div key={item.category} className="group">
            {/* Header row: Category name and amount */}
            <div className="flex items-center justify-between text-sm mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.light.ink }}
                />
                <span className="font-medium text-[#1b1d1f] dark:text-[#f3f5f7]">
                  {item.category}
                </span>
                <span className="text-xs text-[#5c6064] dark:text-[#9ca1a8] tabular-nums">
                  {item.percentage}%
                </span>
              </div>
              <span className="font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums">
                {formatted.whole}
                <span className="text-xs text-[#5c6064] dark:text-[#9ca1a8]">
                  {formatted.decimal}
                </span>
              </span>
            </div>

            {/* Single-hue bar */}
            <div className="w-full h-2 bg-[#f2f4f7] dark:bg-[#25282d] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: cat.light.ink,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
