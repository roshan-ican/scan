import React, { useState, useEffect } from 'react';
import {
  SUPPORTED_CURRENCIES,
  formatMoney,
  setStoredCurrency,
} from '../lib/money.ts';
import {
  checkStorageStatus,
  requestPersistentStorage,
  exportExpensesToJson,
  exportExpensesToCsv,
  importExpensesFromJson,
  db,
  initializeSeedDataIfEmpty,
} from '../db.ts';
import {
  Download,
  Upload,
  HardDrive,
  CheckCircle2,
  ShieldCheck,
  Moon,
  Sun,
  Smartphone,
  ExternalLink,
  CreditCard,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface SettingsScreenProps {
  currency: string;
  onCurrencyChange: (newCurrency: string) => void;
  onDataChanged: () => Promise<void>;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currency,
  onCurrencyChange,
  onDataChanged,
  isDark,
  onToggleTheme,
}) => {
  const [storageStatus, setStorageStatus] = useState<{ persisted: boolean; usage?: number; quota?: number }>({
    persisted: false,
  });
  const [persistMsg, setPersistMsg] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');
  const [showWalletDetails, setShowWalletDetails] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  useEffect(() => {
    checkStorageStatus().then(setStorageStatus);
  }, []);

  const handleRequestPersist = async () => {
    const success = await requestPersistentStorage();
    const updated = await checkStorageStatus();
    setStorageStatus(updated);
    if (success || updated.persisted) {
      setPersistMsg('Storage is now persistent. Safari will preserve your expenses.');
    } else {
      setPersistMsg('Persistent storage request completed (Safari best-effort retention).');
    }
  };

  const handleExportJson = async () => {
    const jsonStr = await exportExpensesToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    const csvStr = await exportExpensesToCsv();
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importExpensesFromJson(text, 'merge');
      setImportStatus(`Successfully imported ${res.imported} expenses!`);
      await onDataChanged();
    } catch (err: any) {
      setImportStatus(`Import failed: ${err?.message || 'Invalid format'}`);
    }
  };

  const handleResetData = async () => {
    await db.expenses.clear();
    await initializeSeedDataIfEmpty(currency);
    await onDataChanged();
    setShowResetConfirm(false);
  };

  const samplePreview = formatMoney(1240.5, currency).full;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-28 md:pb-12 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-[28px] font-bold text-[#1b1d1f] dark:text-[#f3f5f7] tracking-tight">
          Settings
        </h1>
        <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-0.5">
          Currency, Storage, Backups & Shortcuts
        </p>
      </header>

      {/* Currency Selection */}
      <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-5 border border-[#e6e6e6] dark:border-[#2c2e33] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
              Currency
            </h2>
            <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-0.5">
              Preview format: <span className="font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums">{samplePreview}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {SUPPORTED_CURRENCIES.map((c) => {
            const isSelected = currency === c.symbol;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setStoredCurrency(c.symbol);
                  onCurrencyChange(c.symbol);
                }}
                className={`py-2 px-3 rounded-[10px] text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] shadow-xs'
                    : 'bg-[#f3f5f7] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] hover:bg-slate-200'
                }`}
              >
                <span>{c.code}</span>
                <span className="text-sm font-bold">{c.symbol}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Storage on this phone */}
      <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-5 border border-[#e6e6e6] dark:border-[#2c2e33] space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
                Storage: Kept on this phone
              </h2>
              {storageStatus.persisted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Persisted
                </span>
              )}
            </div>
            <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-1 leading-relaxed">
              Your expense history and scan receipts live inside browser IndexedDB on your device.
              Data never leaves your phone; only receipt images are sent to Gemini for reading.
            </p>
          </div>
        </div>

        {!storageStatus.persisted ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleRequestPersist}
              className="py-2 px-3 rounded-[10px] bg-[#f2f8fd] dark:bg-[#1f252d] border border-[#d0e4f7] dark:border-[#2f3947] text-xs font-semibold text-[#1d5fd6] dark:text-[#7bb0ff] hover:bg-[#e6f2fd] transition-colors cursor-pointer"
            >
              Ask Safari to Keep Data Persistently
            </button>
            {persistMsg && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                {persistMsg}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Safari persistent storage active.
          </p>
        )}
      </section>

      {/* Backup and Restore */}
      <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-5 border border-[#e6e6e6] dark:border-[#2c2e33] space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
            Backup & Export
          </h2>
          <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-0.5">
            Because data lives only on your phone, download regular backups.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleExportJson}
            className="h-11 px-3 rounded-[10px] bg-[#f3f5f7] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Backup</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-11 px-3 rounded-[10px] bg-[#f3f5f7] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Sheet</span>
          </button>
        </div>

        {/* Import JSON */}
        <div className="pt-2 border-t border-[#e6e6e6] dark:border-[#2c2e33]">
          <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1.5">
            Restore / Import JSON Backup
          </label>
          <div className="flex items-center gap-2">
            <label className="h-10 px-4 rounded-[10px] bg-slate-100 dark:bg-[#25282d] text-xs font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] flex items-center gap-1.5 cursor-pointer hover:bg-slate-200 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Choose Backup File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChangeWrapper(handleFileImport)}
                className="hidden"
              />
            </label>
            {importStatus && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {importStatus}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Phase 2: Apple Wallet Preview */}
      <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-5 border border-[#e6e6e6] dark:border-[#2c2e33] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
              Apple Wallet (Phase 2 Preview)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowWalletDetails(!showWalletDetails)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {showWalletDetails ? 'Hide Pass' : 'View Pass Preview'}
          </button>
        </div>

        <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] leading-relaxed">
          Generating signed <span className="font-mono">.pkpass</span> Apple Wallet files requires an active Apple Developer
          Team ID and cryptographic certificate. Below is a preview of the interactive receipt pass designed for Phase 2.
        </p>

        {showWalletDetails && (
          <div className="pt-2">
            {/* Apple Wallet Pass Simulation Card */}
            <div className="w-full max-w-sm mx-auto bg-[#1b1d1f] text-white rounded-2xl p-5 shadow-lg border border-slate-700 space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold tracking-wider uppercase text-slate-200">
                  EXPENSE RECEIPT
                </span>
                <span>Nov 7, 2026</span>
              </div>

              <div className="flex justify-between items-end pt-2">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                    MERCHANT
                  </span>
                  <span className="text-lg font-bold">Nature's Basket</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                    TOTAL
                  </span>
                  <span className="text-2xl font-bold tabular-nums">₹1,240.00</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">CATEGORY</span>
                  <span>Groceries</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">VERIFIED BY</span>
                  <span>Gemini AI Studio</span>
                </div>
              </div>

              {/* Barcode representation */}
              <div className="pt-3 flex flex-col items-center justify-center">
                <div className="h-9 w-44 bg-white rounded flex items-center justify-center px-2 py-1">
                  <div className="w-full h-full flex justify-between items-stretch">
                    {[3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9].map((w, i) => (
                      <div
                        key={i}
                        className="bg-black"
                        style={{ width: `${(w % 3) + 1.5}px` }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-1">
                  EXP-9AFE9941-0581
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Shortcuts, Back Tap & Home Screen Instructions */}
      <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-5 border border-[#e6e6e6] dark:border-[#2c2e33] space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#1b1d1f] dark:text-[#f3f5f7]" />
          <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
            Shortcuts & Back Tap One-Touch Setup
          </h2>
        </div>

        <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] leading-relaxed">
          Open the tracker with a single back tap or lock screen button:
        </p>

        <ol className="text-xs text-[#5c6064] dark:text-[#9ca1a8] space-y-2 list-decimal list-inside leading-relaxed pl-1">
          <li>
            Open the <strong>Shortcuts</strong> app on your iPhone and tap <strong>+</strong>.
          </li>
          <li>
            Add action: <strong>Open URL</strong> and enter your app link:{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#1b1d1f] dark:text-[#f3f5f7] font-mono text-[11px]">
              {typeof window !== 'undefined' ? `${window.location.origin}/scan` : 'https://<your-app>/scan'}
            </code>
          </li>
          <li>
            Go to <strong>Settings → Accessibility → Touch → Back Tap</strong>.
          </li>
          <li>
            Choose <strong>Double Tap</strong> or <strong>Triple Tap</strong> and select your shortcut!
          </li>
        </ol>
      </section>

      {/* Theme Preference */}
      <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-5 border border-[#e6e6e6] dark:border-[#2c2e33] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isDark ? (
            <Moon className="w-5 h-5 text-indigo-400" />
          ) : (
            <Sun className="w-5 h-5 text-amber-500" />
          )}
          <div>
            <h2 className="text-sm font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
              Theme
            </h2>
            <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8]">
              {isDark ? 'Dark Mode (Neutral Black)' : 'Light Mode (Pastel Ground)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="px-3 py-1.5 rounded-[10px] bg-[#f3f5f7] dark:bg-[#25282d] text-xs font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] hover:bg-slate-200 cursor-pointer"
        >
          Switch to {isDark ? 'Light' : 'Dark'}
        </button>
      </section>

      {/* Reset / Clear Data */}
      <section className="bg-white dark:bg-[#1a1b1e] rounded-[20px] p-5 border border-[#e6e6e6] dark:border-[#2c2e33]">
        {!showResetConfirm ? (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-2.5 rounded-[10px] text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-[#25282d] flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-[10px] space-y-2 text-center">
            <p className="text-xs text-slate-700 dark:text-slate-300">
              Reset database and restore sample expenses?
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetData}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
              >
                Yes, Reset
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

// Helper for file input wrapper
function handleFileChangeWrapper(
  fn: (e: React.ChangeEvent<HTMLInputElement>) => void
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    fn(e);
  };
}
