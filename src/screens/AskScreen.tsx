import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Mic, RotateCcw, Send, Volume2, VolumeX } from 'lucide-react';
import type { Expense } from '../db.ts';
import { localDateStr, toRows } from '../lib/expenseQuery.ts';
import { MicError, WavRecorder } from '../lib/wavRecorder.ts';
import { DraftExpenseCard, type DraftExpense, type DraftState } from '../components/DraftExpenseCard.tsx';

interface AskScreenProps {
  expenses: Expense[];
  currency: string;
  /** Stores a confirmed draft without leaving this screen. */
  onSaveDraft: (expense: Omit<Expense, 'id'>) => Promise<void>;
}

type Payload = { text: string } | { audioBase64: string; mimeType: string };

interface Turn {
  id: number;
  question: string; // what the user typed, or what Gemini heard
  answer?: string;
  draft?: DraftExpense;
  draftState?: DraftState;
  error?: string;
  payload: Payload;
}

type Status = 'idle' | 'starting' | 'listening' | 'thinking';

const MUTE_KEY = 'ask_muted';

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find((v) => v.lang === 'en-IN') ||
    voices.find((v) => v.lang === navigator.language) ||
    voices.find((v) => v.lang.startsWith('en'))
  );
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  }
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

/** iOS only lets speech start from a gesture; an empty utterance during the press unlocks later replies. */
function unlockSpeech() {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

export const AskScreen: React.FC<AskScreenProps> = ({ expenses, currency, onSaveDraft }) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [mode, setMode] = useState<'voice' | 'type'>('voice');
  const [text, setText] = useState('');
  const [muted, setMuted] = useState<boolean>(readMuted);
  const [level, setLevel] = useState(0);
  const [micProblem, setMicProblem] = useState<string>('');
  const [hint, setHint] = useState<string>('');

  const recorderRef = useRef<WavRecorder | null>(null);
  const holdingRef = useRef(false);
  const nextId = useRef(1);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const now = new Date();
  const today = localDateStr(now);
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', {
    month: 'long',
  });
  const suggestions = [
    'How much did I spend this month, by category?',
    'What was my biggest expense this week?',
    `How does this month compare with ${lastMonthName}?`,
  ];

  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (muted) window.speechSynthesis?.cancel();
  }, [muted]);

  // Voices load asynchronously in Safari.
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => {
      recorderRef.current?.cancel();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, status]);

  const updateTurn = (id: number, patch: Partial<Turn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const ask = async (payload: Payload, existingId?: number) => {
    const id = existingId ?? nextId.current++;
    const question = 'text' in payload ? payload.text : '';
    if (existingId) {
      updateTurn(id, { error: undefined, answer: undefined });
    } else {
      setTurns((prev) => [...prev, { id, question, payload }]);
    }
    setStatus('thinking');

    // Earlier answered turns, for follow-ups like "and last month?".
    const history = turns
      .filter((t) => t.id !== id && t.answer && t.question)
      .slice(-4)
      .map((t) => ({ q: t.question, a: t.answer! }));

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          rows: toRows(expenses),
          history,
          today,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.data) throw new Error(json?.error || `Request failed (${res.status})`);

      const { heard, answer, draft } = json.data as { heard: string; answer: string; draft: DraftExpense | null };
      updateTurn(id, {
        question: heard || question || 'Your question',
        answer,
        draft: draft ?? undefined,
        draftState: draft ? 'pending' : undefined,
      });
      if (!muted) speak(answer);
    } catch (err: any) {
      console.error('Ask failed:', err);
      const message = String(err?.message || '');
      updateTurn(id, {
        question: question || 'Your question',
        error:
          navigator.onLine === false
            ? "You're offline. Connect and try again."
            : message.includes('GEMINI_API_KEY')
              ? 'The server has no Gemini key yet. Add GEMINI_API_KEY to .env and restart it.'
              : "Couldn't get an answer.",
      });
    } finally {
      setStatus('idle');
    }
  };

  // ---- Push to talk -------------------------------------------------------

  const startHold = async () => {
    if (status !== 'idle') return;
    holdingRef.current = true;
    setHint('');
    setMicProblem('');
    unlockSpeech();
    window.speechSynthesis?.cancel();

    const recorder = new WavRecorder();
    recorderRef.current = recorder;
    setStatus('starting');
    try {
      await recorder.start(
        (l) => setLevel(l),
        () => endHold() // 30 s limit
      );
      if (!holdingRef.current) {
        // Let go while the permission prompt was open.
        recorder.cancel();
        setStatus('idle');
        return;
      }
      setStatus('listening');
    } catch (err) {
      setStatus('idle');
      holdingRef.current = false;
      if (err instanceof MicError) {
        setMicProblem(
          err.kind === 'denied'
            ? 'Microphone is blocked. Allow it in Settings → Safari → Microphone, or type your question.'
            : err.kind === 'insecure'
              ? 'The microphone only works on the HTTPS address of this app. You can type your question.'
              : 'No microphone found. You can type your question.'
        );
        setMode('type');
      }
    }
  };

  const endHold = async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    const recorder = recorderRef.current;
    if (!recorder || !recorder.isRecording) return; // still starting; startHold cleans up
    setLevel(0);
    const recording = await recorder.stop();
    setStatus('idle');
    if (!recording || recording.durationMs < 500) {
      setHint('Hold the button while you speak, then let go.');
      return;
    }
    ask({ audioBase64: recording.base64, mimeType: recording.mimeType });
  };

  // ---- Drafts -------------------------------------------------------------

  const saveDraft = async (turn: Turn, draft: DraftExpense) => {
    updateTurn(turn.id, { draftState: 'saving' });
    try {
      const createdAt = draft.date === today ? new Date().toISOString() : new Date(`${draft.date}T12:00:00`).toISOString();
      await onSaveDraft({
        amount: draft.amount,
        currency,
        category: draft.category,
        merchant: draft.merchant || undefined,
        note: draft.note || undefined,
        createdAt,
        receiptDate: draft.date,
        source: 'typed',
      });
      updateTurn(turn.id, { draft, draftState: 'saved' });
    } catch (err) {
      console.error('Saving draft failed:', err);
      updateTurn(turn.id, { draftState: 'pending' });
    }
  };

  const submitText = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || status !== 'idle') return;
    setText('');
    ask({ text: q });
  };

  const busy = status === 'thinking';
  const listening = status === 'listening';

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-[calc(13rem+env(safe-area-inset-bottom))] md:pb-40">
      <header className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1b1d1f] dark:text-[#f3f5f7]">Ask</h1>
          <p className="text-sm text-[#5c6064] dark:text-[#9ca1a8] mt-0.5">
            Ask about your spending, or say what you bought.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={!muted}
          aria-label={muted ? 'Read answers aloud' : 'Stop reading answers aloud'}
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[#5c6064] dark:text-[#9ca1a8] hover:bg-[#e5e8ec] dark:hover:bg-[#25282d] cursor-pointer"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </header>

      {turns.length === 0 ? (
        <section aria-labelledby="ask-examples" className="bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-[#e6e6e6] dark:border-[#2c2e33] p-5">
          <h2 id="ask-examples" className="text-base font-semibold text-[#1b1d1f] dark:text-[#f3f5f7]">
            Try asking
          </h2>
          <div className="mt-3 flex flex-col items-start gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask({ text: s })}
                disabled={status !== 'idle'}
                className="text-left px-3.5 py-2 rounded-[10px] bg-[#f2f8fd] dark:bg-[#222428] text-[15px] text-[#0a3a80] dark:text-[#9cc2ff] hover:bg-[#e3f0fb] dark:hover:bg-[#2a2d33] active:scale-[0.98] transition-transform cursor-pointer"
              >
                {s}
              </button>
            ))}
            <p className="mt-1 text-[15px] text-[#1b1d1f] dark:text-[#f3f5f7]">
              Or say <span className="font-semibold">"I spent 250 on lunch at Subway"</span> and confirm the expense.
            </p>
          </div>
          <p className="mt-4 text-[13px] text-[#5c6064] dark:text-[#9ca1a8]">
            To answer, your expense list is sent to Gemini along with your question.
          </p>
        </section>
      ) : (
        <ol className="space-y-4" aria-live="polite">
          {turns.map((turn) => (
            <li key={turn.id} className="bg-white dark:bg-[#1a1b1e] rounded-[20px] border border-[#e6e6e6] dark:border-[#2c2e33] p-5">
              <p className="text-sm text-[#5c6064] dark:text-[#9ca1a8]">
                {turn.question ? `You asked: ${turn.question}` : 'You asked out loud'}
              </p>

              {turn.answer ? (
                <p className="mt-2 text-[17px] leading-relaxed text-[#1b1d1f] dark:text-[#f3f5f7] tabular-nums">
                  {turn.answer}
                </p>
              ) : turn.error ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[15px] text-[#1b1d1f] dark:text-[#f3f5f7]">{turn.error}</p>
                  <button
                    type="button"
                    onClick={() => ask(turn.payload, turn.id)}
                    disabled={status !== 'idle'}
                    className="h-10 px-3 rounded-full text-sm font-semibold text-[#1b1d1f] dark:text-[#f3f5f7] bg-[#e5e8ec] dark:bg-[#2c2f35] flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    Retry
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2" aria-label="Thinking">
                  <div className="h-4 w-11/12 rounded bg-[#eceef1] dark:bg-[#2a2c31]" />
                  <div className="h-4 w-7/12 rounded bg-[#eceef1] dark:bg-[#2a2c31]" />
                </div>
              )}

              {turn.draft && turn.draftState && (
                <DraftExpenseCard
                  draft={turn.draft}
                  state={turn.draftState}
                  currency={currency}
                  today={today}
                  onSave={(d) => saveDraft(turn, d)}
                  onDiscard={() => updateTurn(turn.id, { draftState: 'discarded' })}
                />
              )}
            </li>
          ))}
        </ol>
      )}
      <div ref={listEndRef} />

      {/* Dock: thumb reach, above the bottom bar on the phone */}
      <div className="fixed left-0 right-0 md:left-16 z-30 bottom-[calc(4rem+max(16px,env(safe-area-inset-bottom)))] md:bottom-0 bg-[#f3f5f7] dark:bg-[#111214] border-t border-[#e6e6e6] dark:border-[#2c2e33]">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {(micProblem || hint) && (
            <p role="status" className="mb-2 text-sm text-[#1b1d1f] dark:text-[#f3f5f7]">
              {micProblem || hint}
            </p>
          )}

          {mode === 'voice' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMode('type')}
                aria-label="Type a question instead"
                className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-[#e5e8ec] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] cursor-pointer"
              >
                <Keyboard className="w-5 h-5" />
              </button>

              <button
                type="button"
                disabled={busy}
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  startHold();
                }}
                onPointerUp={endHold}
                onPointerCancel={endHold}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    startHold();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') endHold();
                }}
                aria-label={listening ? 'Listening. Release to send.' : 'Hold to ask'}
                className="relative flex-1 h-[72px] rounded-full bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] text-base font-semibold flex items-center justify-center gap-2.5 select-none touch-none disabled:opacity-70 cursor-pointer active:scale-[0.99] transition-transform"
                style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
              >
                {listening && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[#1d5fd6] motion-safe:transition-transform motion-safe:duration-100"
                    style={{ transform: `scale(${1 + level * 0.06})`, opacity: 0.9 }}
                  />
                )}
                <Mic className="relative w-5 h-5" aria-hidden="true" />
                <span className="relative">
                  {listening ? 'Listening… let go to send' : status === 'starting' ? 'Starting mic…' : busy ? 'Thinking…' : 'Hold to ask'}
                </span>
              </button>
            </div>
          ) : (
            <form onSubmit={submitText} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('voice');
                  setMicProblem('');
                }}
                aria-label="Ask by voice instead"
                className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-[#e5e8ec] dark:bg-[#25282d] text-[#1b1d1f] dark:text-[#f3f5f7] cursor-pointer"
              >
                <Mic className="w-5 h-5" />
              </button>
              <label htmlFor="ask-text" className="sr-only">
                Your question
              </label>
              <input
                id="ask-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="How much on food this month?"
                enterKeyHint="send"
                autoComplete="off"
                className="flex-1 min-w-0 h-12 px-4 rounded-full bg-white dark:bg-[#1a1b1e] border border-[#d6d9dd] dark:border-[#3a3d42] text-[16px] text-[#1b1d1f] dark:text-[#f3f5f7] placeholder:text-[#6b6f73] dark:placeholder:text-[#8f949b] focus:outline-none focus:ring-2 focus:ring-[#1d5fd6]"
              />
              <button
                type="submit"
                disabled={!text.trim() || status !== 'idle'}
                aria-label="Send question"
                className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center bg-[#1b1d1f] dark:bg-white text-white dark:text-[#1b1d1f] disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
