import React from 'react';
import { Home, History, Settings, Plus, Camera } from 'lucide-react';

export type ScreenId = 'home' | 'history' | 'settings' | 'add' | 'scan';

interface NavigationProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentScreen, onNavigate }) => {
  const tabs = [
    { id: 'home' as ScreenId, label: 'Home', icon: Home },
    { id: 'history' as ScreenId, label: 'History', icon: History },
    { id: 'settings' as ScreenId, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop / Tablet Left Icon Rail (>= 768px, ~60px wide) */}
      <aside className="hidden md:flex flex-col items-center justify-between w-16 bg-white dark:bg-[#1a1b1e] border-r border-[#e6e6e6] dark:border-[#2c2e33] py-6 fixed left-0 top-0 bottom-0 z-40">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* App Wordmark / Logo */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="w-10 h-10 rounded-xl bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] flex items-center justify-center font-bold text-lg shadow-sm"
            aria-label="Home"
          >
            ₹
          </button>

          {/* Navigation icons */}
          <nav className="flex flex-col items-center gap-3 w-full px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentScreen === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onNavigate(tab.id)}
                  aria-label={tab.label}
                  className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#1b1d1f] dark:bg-[#f3f5f7] text-white dark:text-[#1b1d1f]'
                      : 'text-[#5c6064] dark:text-[#9ca1a8] hover:bg-slate-100 dark:hover:bg-[#25282d]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Add / Scan buttons in desktop rail */}
        <div className="flex flex-col items-center gap-3 w-full px-2">
          <button
            type="button"
            onClick={() => onNavigate('scan')}
            title="Scan Receipt"
            className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
              currentScreen === 'scan'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] hover:bg-slate-200'
            }`}
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('add')}
            title="Type Expense"
            className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
              currentScreen === 'add'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] hover:bg-slate-200'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Mobile Fixed Bottom Bar (< 768px, 44px+ touch targets, safe-area padded) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1a1b1e]/95 backdrop-blur-md border-t border-[#e6e6e6] dark:border-[#2c2e33] pb-safe"
      >
        <div className="grid grid-cols-3 h-16 max-w-md mx-auto items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentScreen === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#1b1d1f] dark:text-white font-semibold'
                    : 'text-[#5c6064] dark:text-[#9ca1a8] hover:text-[#1b1d1f] dark:hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.7]'}`} />
                <span className="text-[11px] mt-1">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
