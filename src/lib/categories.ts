import React from 'react';
import {
  Utensils,
  ShoppingBag,
  Car,
  Tag,
  Receipt,
  HeartPulse,
  Film,
  Plane,
  MoreHorizontal,
  LucideIcon
} from 'lucide-react';

export interface CategoryDef {
  name: string;
  icon: LucideIcon;
  // Pastel consumer style: pale tint with dark ink of the same hue (contrast >= 4.5:1)
  light: {
    tint: string;
    ink: string;
    border: string;
  };
  dark: {
    tint: string;
    ink: string;
    border: string;
  };
}

export const CATEGORIES: CategoryDef[] = [
  {
    name: 'Food & Dining',
    icon: Utensils,
    light: { tint: '#ffedd5', ink: '#9a3412', border: '#fed7aa' },
    dark: { tint: '#431407', ink: '#fdba74', border: '#7c2d12' },
  },
  {
    name: 'Groceries',
    icon: ShoppingBag,
    light: { tint: '#ecfccb', ink: '#365314', border: '#d9f99d' },
    dark: { tint: '#1a2e05', ink: '#bef264', border: '#365314' },
  },
  {
    name: 'Transport',
    icon: Car,
    light: { tint: '#dcf1ff', ink: '#0a3a80', border: '#b9e2fe' },
    dark: { tint: '#082f49', ink: '#7dd3fc', border: '#0369a1' },
  },
  {
    name: 'Shopping',
    icon: Tag,
    light: { tint: '#fce7f3', ink: '#831843', border: '#fbcfe8' },
    dark: { tint: '#500724', ink: '#f472b6', border: '#831843' },
  },
  {
    name: 'Bills & Utilities',
    icon: Receipt,
    light: { tint: '#fef3c7', ink: '#78350f', border: '#fde68a' },
    dark: { tint: '#451a03', ink: '#fcd34d', border: '#92400e' },
  },
  {
    name: 'Health',
    icon: HeartPulse,
    light: { tint: '#e0e7ff', ink: '#312e81', border: '#c7d2fe' },
    dark: { tint: '#1e1b4b', ink: '#a5b4fc', border: '#3730a3' },
  },
  {
    name: 'Entertainment',
    icon: Film,
    light: { tint: '#fae8ff', ink: '#701a75', border: '#f5d0fe' },
    dark: { tint: '#4a044e', ink: '#f0abfc', border: '#86198f' },
  },
  {
    name: 'Travel',
    icon: Plane,
    light: { tint: '#ccfbf1', ink: '#115e59', border: '#99f6e4' },
    dark: { tint: '#042f2e', ink: '#5eead4', border: '#115e59' },
  },
  {
    name: 'Other',
    icon: MoreHorizontal,
    light: { tint: '#f1f5f9', ink: '#334155', border: '#e2e8f0' },
    dark: { tint: '#1e293b', ink: '#94a3b8', border: '#334155' },
  },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

export function getCategoryDef(name?: string | null): CategoryDef {
  if (!name) return CATEGORIES[8]; // 'Other'
  const match = CATEGORIES.find(
    (c) => c.name.toLowerCase() === name.toLowerCase().trim()
  );
  return match || CATEGORIES[8];
}
