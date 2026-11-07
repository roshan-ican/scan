import React, { useState, useRef } from 'react';
import type { Expense } from '../db.ts';
import { resizeImageToJpeg } from '../lib/image.ts';
import { parseAndValidateScanResult, ValidatedScanResult } from '../lib/scanResult.ts';
import { CATEGORIES } from '../lib/categories.ts';
import { CategoryChip } from '../components/CategoryChip.tsx';
import {
  Camera,
  ArrowLeft,
  Store,
  Calendar,
  Check,
  RefreshCw,
  Edit2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Sparkles
} from 'lucide-react';

interface ScanReviewScreenProps {
  currency: string;
  onSave: (expense: Omit<Expense, 'id'>) => Promise<void>;
  onCancel: () => void;
  onNavigateToType: () => void;
}

export const ScanReviewScreen: React.FC<ScanReviewScreenProps> = ({
  currency,
  onSave,
  onCancel,
  onNavigateToType,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow states: 'capture' | 'loading' | 'review' | 'error'
  const [stage, setStage] = useState<'capture' | 'loading' | 'review' | 'error'>('capture');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Review Form States
  const [merchant, setMerchant] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [detectedCurrency, setDetectedCurrency] = useState<string>(currency);
  const [dateStr, setDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('Other');
  const [proofLine, setProofLine] = useState<string>('');
  const [items, setItems] = useState<Array<{ name: string; amount: number }>>([]);
  const [showItems, setShowItems] = useState<boolean>(false);
  const [isEditingProof, setIsEditingProof] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Trigger camera file picker
  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle image capture / selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStage('loading');
    setErrorMessage('');

    try {
      // 1. Shrink photo to ~1600px JPEG
      const { base64, mimeType, dataUrl } = await resizeImageToJpeg(file, 1600, 0.85);
      setThumbnailUrl(dataUrl);

      // 2. Call scan proxy
      await processReceiptImage(base64, mimeType, dataUrl);
    } catch (err: any) {
      console.error('Scan error:', err);
      setStage('error');
      setErrorMessage(err?.message || "Couldn't read this receipt.");
    }
  };

  // Process receipt image via /api/scan
  const processReceiptImage = async (base64: string, mimeType: string, dataUrl: string) => {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Scan proxy error (${res.status})`);
      }

      const json = await res.json();
      const rawData = json.data;

      // Validate & normalize
      const validated = parseAndValidateScanResult(rawData, currency);
      if (!validated) {
        setStage('error');
        setErrorMessage("Couldn't read this receipt. The image does not appear to be a readable receipt.");
        return;
      }

      // Populate review form
      setMerchant(validated.merchant);
      setTotal(validated.total !== null ? String(validated.total) : '');
      setDetectedCurrency(validated.currency || currency);
      setDateStr(validated.date);
      setCategory(validated.category);
      setProofLine(validated.totalLine);
      setItems(validated.items || []);
      setStage('review');
    } catch (err: any) {
      setStage('error');
      setErrorMessage(err?.message || "Couldn't read this receipt.");
    }
  };

  // Sample receipt handler for instant testing
  const handleLoadSample = (sampleType: 'coffee' | 'grocery') => {
    setStage('loading');
    setErrorMessage('');

    setTimeout(() => {
      if (sampleType === 'coffee') {
        setThumbnailUrl('/icon.svg');
        setMerchant('Blue Bottle Coffee');
        setTotal('18.50');
        setDetectedCurrency('$');
        setDateStr(new Date().toISOString().split('T')[0]);
        setCategory('Food & Dining');
        setProofLine('GRAND TOTAL  $18.50');
        setItems([
          { name: 'Bella Donovan Pour Over', amount: 6.5 },
          { name: 'Almond Croissant', amount: 5.75 },
          { name: 'Cold Brew Oat Float', amount: 6.25 },
        ]);
        setStage('review');
      } else {
        setThumbnailUrl('/icon.svg');
        setMerchant('Organic Market');
        setTotal('1240.00');
        setDetectedCurrency('₹');
        setDateStr(new Date().toISOString().split('T')[0]);
        setCategory('Groceries');
        setProofLine('NET PAYABLE  ₹1,240.00');
        setItems([
          { name: 'Fresh Strawberries 500g', amount: 380.0 },
          { name: 'Organic Almond Milk 1L', amount: 260.0 },
          { name: 'Sourdough Country Loaf', amount: 220.0 },
          { name: 'Wildflower Honey 300g', amount: 380.0 },
        ]);
        setStage('review');
      }
    }, 700);
  };

  // Save the reviewed expense
  const handleSaveExpense = async () => {
    const num = parseFloat(total);
    if (isNaN(num) || num <= 0) return;

    setIsSaving(true);
    try {
      const now = new Date();
      const timePart = now.toTimeString().slice(0, 8);
      const createdAt = new Date(`${dateStr}T${timePart}`).toISOString();

      await onSave({
        amount: Math.round(num * 100) / 100,
        currency: detectedCurrency,
        category,
        merchant: merchant.trim() || undefined,
        note: items.length > 0 ? `${items.length} items from receipt` : undefined,
        createdAt,
        receiptDate: dateStr,
        source: 'scan',
        totalLine: proofLine || undefined,
        items: items.length > 0 ? items : undefined,
        receiptImage: thumbnailUrl || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-3 pb-24 md:pb-10 min-h-[calc(100vh-80px)] flex flex-col justify-between">
      {/* Hidden camera file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 -ml-2 rounded-full text-[#5c6064] dark:text-[#9ca1a8] hover:bg-slate-100 dark:hover:bg-[#25282d] transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-[#5c6064] dark:text-[#9ca1a8] uppercase tracking-wider">
            {stage === 'review' ? 'Scan Review' : 'Scan Receipt'}
          </span>
          <div className="w-8" />
        </div>

        {/* ================= STAGE 1: CAPTURE ================= */}
        {stage === 'capture' && (
          <div className="space-y-6 text-center py-6">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] flex items-center justify-center shadow-md">
              <Camera className="w-10 h-10 stroke-[1.8]" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
                Scan Receipt
              </h2>
              <p className="text-sm text-[#5c6064] dark:text-[#9ca1a8] max-w-xs mx-auto">
                Take a photo or upload a receipt. Gemini reads store, total, date, and category in one step.
              </p>
            </div>

            <div className="pt-2 space-y-3 max-w-xs mx-auto">
              {/* Primary Camera Button */}
              <button
                type="button"
                onClick={triggerCamera}
                className="w-full h-14 rounded-[14px] bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              >
                <Camera className="w-5 h-5" />
                <span>Open Camera / Upload</span>
              </button>

              {/* Sample test buttons for instant zero-friction review */}
              <div className="pt-4 border-t border-[#e6e6e6] dark:border-[#2c2e33]">
                <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mb-2 font-medium">
                  Or test with sample receipt:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('grocery')}
                    className="py-2.5 px-3 rounded-[10px] bg-[#f2f8fd] dark:bg-[#1f252d] border border-[#d0e4f7] dark:border-[#2f3947] text-xs font-semibold text-[#1d5fd6] dark:text-[#7bb0ff] hover:bg-[#e6f2fd] transition-colors cursor-pointer"
                  >
                    Grocery Bill (₹1,240)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('coffee')}
                    className="py-2.5 px-3 rounded-[10px] bg-[#f2f8fd] dark:bg-[#1f252d] border border-[#d0e4f7] dark:border-[#2f3947] text-xs font-semibold text-[#1d5fd6] dark:text-[#7bb0ff] hover:bg-[#e6f2fd] transition-colors cursor-pointer"
                  >
                    Cafe Slip ($18.50)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STAGE 2: LOADING ================= */}
        {/* Requirement: "the final layout with flat grey bars at the real sizes, no shimmer." */}
        {stage === 'loading' && (
          <div className="space-y-5 py-4 animate-none" aria-busy="true" aria-label="Reading receipt with Gemini">
            <div className="text-center">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Reading receipt with Gemini...
              </span>
            </div>

            {/* Proof and thumbnail block skeleton */}
            <div className="p-4 bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-[#e6e6e6] dark:border-[#2c2e33] flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="w-24 h-3 bg-slate-200 dark:bg-slate-800 rounded-sm" />
                <div className="w-40 h-5 bg-slate-200 dark:bg-slate-800 rounded-sm" />
              </div>
            </div>

            {/* Total skeleton (largest) */}
            <div className="p-4 bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-[#e6e6e6] dark:border-[#2c2e33] space-y-2">
              <div className="w-20 h-3 bg-slate-200 dark:bg-slate-800 rounded-sm" />
              <div className="w-36 h-9 bg-slate-200 dark:bg-slate-800 rounded-sm" />
            </div>

            {/* Merchant and Date skeletons */}
            <div className="space-y-3">
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-[10px]" />
              <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-[10px]" />
            </div>

            {/* Category chips skeleton */}
            <div className="flex gap-2">
              <div className="w-24 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="w-20 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="w-28 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          </div>
        )}

        {/* ================= STAGE 3: ERROR ================= */}
        {/* Requirement: "Errors stay inside the block: 'Couldn't read this receipt.' with Retry and Type it instead." */}
        {stage === 'error' && (
          <div className="p-6 bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-amber-200 dark:border-amber-900/50 space-y-4 text-center my-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#1b1d1f] dark:text-[#f3f5f7]">
                Couldn't read this receipt.
              </h3>
              <p className="text-xs text-[#5c6064] dark:text-[#9ca1a8] mt-1">
                {errorMessage || 'The image was too blurry or the total could not be identified.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
              <button
                type="button"
                onClick={triggerCamera}
                className="w-full h-12 rounded-[10px] bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Scan</span>
              </button>

              <button
                type="button"
                onClick={onNavigateToType}
                className="w-full h-12 rounded-[10px] bg-[#f3f5f7] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] font-semibold text-xs flex items-center justify-center cursor-pointer hover:bg-slate-200"
              >
                Type it instead
              </button>
            </div>
          </div>
        )}

        {/* ================= STAGE 4: REVIEW ("Is this right?") ================= */}
        {stage === 'review' && (
          <div className="space-y-4">
            {/* Question: "Is this right?" */}
            <div className="text-center mb-1">
              <h2 className="text-sm font-semibold text-[#5c6064] dark:text-[#9ca1a8]">
                Is this right?
              </h2>
            </div>

            {/* Proof Block: Quoted receipt line beside cropped thumbnail */}
            <div className="p-4 bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-[#e6e6e6] dark:border-[#2c2e33] flex items-center gap-3.5">
              {/* Cropped thumbnail */}
              {thumbnailUrl ? (
                <div className="relative w-18 h-18 rounded-[12px] overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                  <img
                    src={thumbnailUrl}
                    alt="Receipt thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-18 h-18 rounded-[12px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
              )}

              {/* The element only this app has: the receipt line as proof */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#1d5fd6] dark:text-[#4b86f0] uppercase tracking-wide">
                    Receipt line as proof
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingProof(!isEditingProof)}
                    className="text-[11px] text-[#5c6064] dark:text-[#9ca1a8] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingProof ? 'Done' : 'Edit'}</span>
                  </button>
                </div>

                {!isEditingProof ? (
                  <p
                    className="font-mono text-sm font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] mt-0.5 truncate bg-[#f2f8fd] dark:bg-[#1a2330] px-2 py-1 rounded-md border border-[#d6e7f7] dark:border-[#25394d]"
                    title={proofLine}
                  >
                    {proofLine || 'Total extracted from receipt'}
                  </p>
                ) : (
                  <input
                    type="text"
                    value={proofLine}
                    onChange={(e) => setProofLine(e.target.value)}
                    className="w-full h-8 mt-1 px-2 text-xs font-mono rounded bg-[#f3f5f7] dark:bg-[#111214] border border-[#e6e6e6] dark:border-[#2c2e33]"
                  />
                )}
                <span className="text-[11px] text-[#5c6064] dark:text-[#9ca1a8] block mt-1">
                  Extracted from receipt photo
                </span>
              </div>
            </div>

            {/* Extracted Total (Largest on screen) */}
            <div className="p-4 bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-[#e6e6e6] dark:border-[#2c2e33]">
              <label className="block text-xs font-semibold text-[#5c6064] dark:text-[#9ca1a8] mb-1">
                Grand Total Amount
              </label>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#5c6064] dark:text-[#9ca1a8]">
                  {detectedCurrency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-[36px] font-bold text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums tracking-tight bg-transparent border-0 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Merchant and Date */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
                  Store / Merchant
                </label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Store name"
                    className="w-full h-11 pl-10 pr-3 text-sm rounded-[10px] bg-white dark:bg-[#1a1b1e] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7] focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5c6064] dark:text-[#9ca1a8] mb-1">
                  Receipt Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5c6064] dark:text-[#9ca1a8]" />
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 text-sm rounded-[10px] bg-white dark:bg-[#1a1b1e] border border-[#e6e6e6] dark:border-[#2c2e33] text-[#1b1d1f] dark:text-[#f3f5f7]"
                  />
                </div>
              </div>
            </div>

            {/* Suggested Category with preselected chip */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#5c6064] dark:text-[#9ca1a8] mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-medium">Suggested Category</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <CategoryChip
                    key={cat.name}
                    category={cat.name}
                    isSelected={category === cat.name}
                    onClick={() => setCategory(cat.name)}
                    size="sm"
                  />
                ))}
              </div>
            </div>

            {/* Collapsed Items List */}
            {items.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowItems(!showItems)}
                  className="w-full py-2 px-3 rounded-[10px] bg-slate-100 dark:bg-[#25282d] text-xs font-medium text-[#1b1d1f] dark:text-[#f3f5f7] flex items-center justify-between cursor-pointer"
                >
                  <span>{items.length} line items detected</span>
                  {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showItems && (
                  <div className="mt-2 p-3 bg-white dark:bg-[#1a1b1e] rounded-[10px] border border-[#e6e6e6] dark:border-[#2c2e33] space-y-1.5 text-xs">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-[#1b1d1f] dark:text-[#f3f5f7]">{item.name}</span>
                        <span className="font-mono text-[#5c6064] dark:text-[#9ca1a8]">
                          {detectedCurrency}{item.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Actions Pin Bottom */}
      {stage === 'review' && (
        <div className="pt-4 space-y-2">
          <button
            type="button"
            onClick={handleSaveExpense}
            disabled={isSaving || !total || parseFloat(total) <= 0}
            className="w-full h-13 rounded-[12px] bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : `Confirm & Save ${detectedCurrency}${total}`}</span>
          </button>

          <button
            type="button"
            onClick={() => setStage('capture')}
            className="w-full py-2 text-xs text-[#5c6064] dark:text-[#9ca1a8] hover:underline text-center cursor-pointer"
          >
            Scan a different receipt
          </button>
        </div>
      )}
    </div>
  );
};
