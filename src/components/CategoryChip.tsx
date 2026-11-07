import React from 'react';
import { getCategoryDef } from '../lib/categories.ts';

interface CategoryChipProps {
  category: string;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  isDark?: boolean;
  className?: string;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  category,
  isSelected = false,
  onClick,
  size = 'sm',
  showIcon = false,
  className = '',
}) => {
  const catDef = getCategoryDef(category);
  const Icon = catDef.icon;

  const isClickable = Boolean(onClick);

  const sharedStyles = {
    backgroundColor: 'var(--cat-tint, ' + catDef.light.tint + ')',
    color: 'var(--cat-ink, ' + catDef.light.ink + ')',
    borderColor: 'var(--cat-border, ' + catDef.light.border + ')',
  };

  const sharedClasses = `inline-flex items-center gap-1.5 font-medium rounded-lg transition-all duration-150 ${
    size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  } ${
    isClickable ? 'cursor-pointer active:scale-95' : 'cursor-default'
  } ${
    isSelected ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-slate-900 shadow-sm' : ''
  } ${className}`;

  if (!isClickable) {
    return (
      <span
        className={sharedClasses}
        style={sharedStyles}
        data-category={category}
      >
        {showIcon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
        <span>{category}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={sharedClasses}
      style={sharedStyles}
      data-category={category}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      <span>{category}</span>
    </button>
  );
};
