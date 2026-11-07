import React, { useState, useEffect, useCallback } from 'react';
import { db, initializeSeedDataIfEmpty, type Expense } from './db.ts';
import { getStoredCurrency } from './lib/money.ts';
import { Navigation, type ScreenId } from './components/Navigation.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { AddExpenseScreen } from './screens/AddExpenseScreen.tsx';
import { ScanReviewScreen } from './screens/ScanReviewScreen.tsx';
import { HistoryScreen } from './screens/HistoryScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { ExpenseEditModal } from './components/ExpenseEditModal.tsx';

export default function App() {
  const [currency, setCurrency] = useState<string>(getStoredCurrency());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Theme state: dark mode support
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_preference');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Screen routing state (supporting /scan, /add, /history, /settings direct URLs for iOS Shortcuts)
  const getInitialScreen = (): ScreenId => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path === '/scan') return 'scan';
      if (path === '/add') return 'add';
      if (path === '/history') return 'history';
      if (path === '/settings') return 'settings';
    }
    return 'home';
  };

  const [currentScreen, setCurrentScreen] = useState<ScreenId>(getInitialScreen);

  // Sync theme with DOM
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme_preference', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme_preference', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Sync browser URL with screen
  const navigateTo = useCallback((screen: ScreenId) => {
    setCurrentScreen(screen);
    const path = screen === 'home' ? '/' : `/${screen}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  // Listen to popstate (back/forward browser buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentScreen(getInitialScreen());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load expenses from Dexie
  const loadExpenses = useCallback(async () => {
    try {
      await initializeSeedDataIfEmpty(currency);
      const all = await db.expenses.orderBy('createdAt').reverse().toArray();
      setExpenses(all);
    } catch (err) {
      console.error('Failed to load expenses from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Handle Add / Save
  const handleSaveExpense = async (newExp: Omit<Expense, 'id'>) => {
    const id = await db.expenses.add(newExp as Expense);
    await loadExpenses();
    navigateTo('home');
  };

  // Handle Update
  const handleUpdateExpense = async (updated: Expense) => {
    if (!updated.id) return;
    await db.expenses.put(updated);
    await loadExpenses();
  };

  // Handle Delete
  const handleDeleteExpense = async (id: number) => {
    await db.expenses.delete(id);
    await loadExpenses();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f5f7] dark:bg-[#111214]">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] flex items-center justify-center font-bold text-lg mx-auto">
            {currency}
          </div>
          <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8]">
            Loading expenses...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f5f7] dark:bg-[#111214] text-[#1b1d1f] dark:text-[#f3f5f7] flex">
      {/* Navigation (Left icon rail on >=md, Bottom bar on <md) */}
      <Navigation currentScreen={currentScreen} onNavigate={navigateTo} />

      {/* Main Screen Content Area */}
      <main className="flex-1 w-full md:pl-16 min-h-screen flex flex-col">
        {currentScreen === 'home' && (
          <HomeScreen
            expenses={expenses}
            currency={currency}
            onNavigateToAdd={() => navigateTo('add')}
            onNavigateToScan={() => navigateTo('scan')}
            onNavigateToHistory={() => navigateTo('history')}
            onSelectExpense={(exp) => setEditingExpense(exp)}
          />
        )}

        {currentScreen === 'add' && (
          <AddExpenseScreen
            currency={currency}
            onSave={handleSaveExpense}
            onCancel={() => navigateTo('home')}
          />
        )}

        {currentScreen === 'scan' && (
          <ScanReviewScreen
            currency={currency}
            onSave={handleSaveExpense}
            onCancel={() => navigateTo('home')}
            onNavigateToType={() => navigateTo('add')}
          />
        )}

        {currentScreen === 'history' && (
          <HistoryScreen
            expenses={expenses}
            currency={currency}
            onSelectExpense={(exp) => setEditingExpense(exp)}
          />
        )}

        {currentScreen === 'settings' && (
          <SettingsScreen
            currency={currency}
            onCurrencyChange={(newCur) => setCurrency(newCur)}
            onDataChanged={loadExpenses}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        )}
      </main>

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          currency={currency}
          isOpen={Boolean(editingExpense)}
          onClose={() => setEditingExpense(null)}
          onSave={handleUpdateExpense}
          onDelete={handleDeleteExpense}
        />
      )}
    </div>
  );
}
