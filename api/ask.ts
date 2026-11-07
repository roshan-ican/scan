import {
  GoogleGenAI,
  Type,
  FunctionCallingConfigMode,
  type Content,
  type FunctionDeclaration,
  type Part,
} from '@google/genai';
import type { Request, Response } from 'express';
import { CATEGORY_NAMES } from '../src/lib/categories.ts';
import { queryExpenses, type ExpenseRowTuple, type QueryArgs } from '../src/lib/expenseQuery.ts';
import { currencyPrefix } from '../src/lib/money.ts';

/**
 * Push-to-talk voice agent.
 *
 * The phone sends one question (recorded WAV audio or typed text) together with a compact
 * copy of its expenses. Gemini answers through tools only:
 * - query_expenses runs here, exactly, over the rows the phone sent (Gemini never adds up);
 * - respond ends the turn with what it heard, a short spoken answer, and an optional draft
 *   expense that the user must confirm on the phone before anything is saved.
 */

const MAX_STEPS = 6;
const MAX_ROWS = 10000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DraftExpense {
  amount: number;
  category: string;
  merchant: string;
  note: string;
  date: string;
}

export interface AskResult {
  heard: string;
  answer: string;
  draft: DraftExpense | null;
}

const queryExpensesDecl: FunctionDeclaration = {
  name: 'query_expenses',
  description:
    'Look up the user\'s expenses. Returns the exact total, count, average, optional groups and the top individual expenses. Use it for every figure you mention. Call it several times to compare periods.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      from: { type: Type.STRING, description: 'Inclusive start date, YYYY-MM-DD' },
      to: { type: Type.STRING, description: 'Inclusive end date, YYYY-MM-DD' },
      category: { type: Type.STRING, enum: CATEGORY_NAMES, description: 'Only this category' },
      merchant: { type: Type.STRING, description: 'Store name contains this text (case-insensitive)' },
      text: { type: Type.STRING, description: 'Store name or note contains this text (case-insensitive)' },
      groupBy: {
        type: Type.STRING,
        enum: ['category', 'merchant', 'day', 'month', 'none'],
        description: 'Break the total down by this field',
      },
      limit: { type: Type.INTEGER, description: 'How many individual expenses to return (default 5, max 50)' },
      sort: {
        type: Type.STRING,
        enum: ['amount', 'date'],
        description: 'Return the largest expenses (amount, default) or the most recent (date)',
      },
    },
  },
};

const respondDecl: FunctionDeclaration = {
  name: 'respond',
  description: 'Finish the turn. Always call this exactly once, last.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      heard: {
        type: Type.STRING,
        description: 'What the user said, transcribed in their words (for typed questions, repeat the text)',
      },
      answer: {
        type: Type.STRING,
        description:
          'The reply to be shown and read aloud: 1-3 short spoken sentences, plain text, no markdown, no lists.',
      },
      draft_expense: {
        type: Type.OBJECT,
        nullable: true,
        description: 'Only when the user describes a purchase they made and want to record.',
        properties: {
          amount: { type: Type.NUMBER, description: 'Positive amount in the user\'s currency' },
          category: { type: Type.STRING, enum: CATEGORY_NAMES },
          merchant: { type: Type.STRING, description: 'Store or place, if said' },
          note: { type: Type.STRING, description: 'Short note, if useful' },
          date: { type: Type.STRING, description: 'YYYY-MM-DD; today unless the user said otherwise' },
        },
        required: ['amount', 'category'],
      },
    },
    required: ['heard', 'answer'],
  },
};

function systemInstruction(today: string, timeZone: string, currency: string, rows: ExpenseRowTuple[]): string {
  const dates = rows.map((r) => r[1]).filter(Boolean).sort();
  const weekday = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const range = dates.length ? `from ${dates[0]} to ${dates[dates.length - 1]}` : 'none yet';
  return `You are the voice assistant inside the user's personal expense tracker app on their iPhone.
Today is ${weekday}, ${today} (time zone ${timeZone}). Currency: ${currency}.
Categories: ${CATEGORY_NAMES.join(', ')}.
The user has ${rows.length} recorded expenses, dated ${range}.

Rules:
- Every amount, count or comparison you say must come from query_expenses results. Never add numbers up yourself and never guess.
- Resolve dates yourself: "this month" = first day of this month to today; "last month" = the whole previous month; "this week" = Monday to today; "last week" = previous Monday to Sunday; "today"/"yesterday" = that single day. For "compared with last month" at this point in the month, query last month up to the same day number as well as the whole month, and say which you mean.
- If the user describes something they bought or paid for ("I spent 250 on lunch at Subway"), fill draft_expense and say it is ready to save. Never claim it has been saved: the user confirms it on screen.
- Answers are spoken aloud: 1-3 short sentences, amounts written like ${currencyPrefix(currency)}1,240 (add the decimals only when not .00), no markdown, no lists, no emoji.
- If there are no matching expenses, say so plainly (a real zero).
- If you could not understand the audio, set heard to "" and ask them to try again.
- Always finish by calling respond exactly once.`;
}

function sanitizeRows(input: unknown): ExpenseRowTuple[] {
  if (!Array.isArray(input)) return [];
  const rows: ExpenseRowTuple[] = [];
  for (const r of input.slice(0, MAX_ROWS)) {
    if (!Array.isArray(r) || r.length < 7) continue;
    const [id, date, amount, category, merchant, note, source] = r;
    if (typeof date !== 'string' || !DATE_RE.test(date)) continue;
    const amt = Number(amount);
    if (!Number.isFinite(amt)) continue;
    rows.push([
      Number(id) || 0,
      date,
      amt,
      typeof category === 'string' ? category : 'Other',
      typeof merchant === 'string' ? merchant.slice(0, 120) : '',
      typeof note === 'string' ? note.slice(0, 200) : '',
      source === 'scan' ? 'scan' : 'typed',
    ]);
  }
  return rows;
}

export function validateDraft(raw: unknown, today: string): DraftExpense | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const amount = Math.round(Number(d.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const category =
    CATEGORY_NAMES.find((c) => c.toLowerCase() === String(d.category ?? '').trim().toLowerCase()) ?? 'Other';
  const date = typeof d.date === 'string' && DATE_RE.test(d.date) && d.date <= today ? d.date : today;
  return {
    amount,
    category,
    merchant: typeof d.merchant === 'string' ? d.merchant.trim().slice(0, 80) : '',
    note: typeof d.note === 'string' ? d.note.trim().slice(0, 160) : '',
    date,
  };
}

export async function handleAskRequest(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};
    const audioBase64: string | undefined = typeof body.audioBase64 === 'string' ? body.audioBase64 : undefined;
    const text: string | undefined =
      typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 500) : undefined;

    if (!audioBase64 && !text) {
      res.status(400).json({ error: 'Send either audioBase64 or text' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      return;
    }

    const today = typeof body.today === 'string' && DATE_RE.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
    const timeZone = typeof body.timeZone === 'string' ? body.timeZone.slice(0, 64) : 'UTC';
    const currency = typeof body.currency === 'string' ? body.currency.slice(0, 8) : 'AED';
    const rows = sanitizeRows(body.rows);

    // Earlier turns as plain text so follow-ups ("and last month?") resolve.
    const contents: Content[] = [];
    if (Array.isArray(body.history)) {
      for (const turn of body.history.slice(-4)) {
        if (typeof turn?.q === 'string' && typeof turn?.a === 'string') {
          contents.push({ role: 'user', parts: [{ text: turn.q.slice(0, 500) }] });
          contents.push({ role: 'model', parts: [{ text: turn.a.slice(0, 800) }] });
        }
      }
    }

    const userParts: Part[] = audioBase64
      ? [
          { text: 'The user asked this out loud:' },
          {
            inlineData: {
              data: audioBase64.replace(/^data:[^;]+;base64,/, ''),
              mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'audio/wav',
            },
          },
        ]
      : [{ text: text! }];
    contents.push({ role: 'user', parts: userParts });

    const ai = new GoogleGenAI({ apiKey });
    const config = {
      systemInstruction: systemInstruction(today, timeZone, currency, rows),
      tools: [{ functionDeclarations: [queryExpensesDecl, respondDecl] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
    };

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await ai.models.generateContent({ model, contents, config });
      const calls = response.functionCalls ?? [];

      if (calls.length === 0) {
        // Should not happen with mode ANY; fall back to any text the model produced.
        const fallback = response.text?.trim();
        if (fallback) {
          const result: AskResult = { heard: text ?? '', answer: fallback, draft: null };
          res.json({ success: true, data: result, model });
          return;
        }
        break;
      }

      const respondCall = calls.find((c) => c.name === 'respond');
      if (respondCall) {
        const args = (respondCall.args ?? {}) as Record<string, unknown>;
        const result: AskResult = {
          heard: typeof args.heard === 'string' ? args.heard.trim() : text ?? '',
          answer: typeof args.answer === 'string' ? args.answer.trim() : '',
          draft: validateDraft(args.draft_expense, today),
        };
        if (!result.answer) result.answer = "Sorry, I didn't catch that. Try again?";
        res.json({ success: true, data: result, model, steps: step + 1 });
        return;
      }

      // Keep the model's own turn (it carries thought signatures), then answer each call.
      const modelTurn = response.candidates?.[0]?.content;
      if (modelTurn) contents.push(modelTurn);
      contents.push({
        role: 'user',
        parts: calls.map((call) => ({
          functionResponse: {
            id: call.id,
            name: call.name,
            response:
              call.name === 'query_expenses'
                ? { result: queryExpenses(rows, (call.args ?? {}) as QueryArgs) }
                : { error: `Unknown tool ${call.name}` },
          },
        })),
      });
    }

    res.status(502).json({ error: 'The assistant did not finish its answer. Try asking again.' });
  } catch (error: any) {
    console.error('Error in /api/ask:', error);
    res.status(500).json({ error: error?.message || 'Voice assistant failed' });
  }
}
