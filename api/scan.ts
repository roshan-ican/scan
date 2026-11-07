import { GoogleGenAI, Type } from '@google/genai';
import type { Request, Response } from 'express';

const RECEIPT_PROMPT = `You are an expert receipt and invoice analyzer.
Analyze the provided image of a receipt, cash memo, POS slip, or digital invoice.
Your task is to extract:
1. merchant: The store, restaurant, vendor, or merchant name (null if unreadable).
2. total: The grand total amount paid after all taxes and discounts. Return as a positive float number (e.g. 1240.50). Return null if missing or illegible. Do not guess.
3. currency: The detected currency symbol or code (e.g., ₹, INR, $, USD, €, EUR, £, GBP).
4. date: The transaction date in 'YYYY-MM-DD' format as printed on the receipt (null if unreadable or not found).
5. category: Exactly one of the 9 allowed categories that best fits this purchase:
   - "Food & Dining" (restaurants, cafes, food delivery, fast food, coffee)
   - "Groceries" (supermarkets, food marts, fresh produce, bakeries)
   - "Transport" (fuel, cabs, ride-sharing, tolls, transit tickets)
   - "Shopping" (clothing, electronics, footwear, retail merchandise)
   - "Bills & Utilities" (electricity, water, broadband, phone recharge)
   - "Health" (pharmacy, clinics, doctor consultation, medicine)
   - "Entertainment" (movies, games, events, streaming)
   - "Travel" (hotels, flights, luggage, tourism)
   - "Other" (anything else)
6. total_line: The EXACT printed receipt text line from which the grand total was read. This serves as visual proof to the user (e.g., 'GRAND TOTAL  1,240.00', 'Total Amount: $42.50', 'PAID: ₹350.00').
7. items: Line items with item name and amount, if itemized on the receipt.

If the image is not a receipt or cannot be interpreted at all, return null values for merchant, total, and total_line.`;

export async function handleScanRequest(req: Request, res: Response): Promise<void> {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Missing imageBase64 in request body' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY is not configured in the server environment. Please set GEMINI_API_KEY in your environment variables.',
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    // Clean base64 header if included
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: RECEIPT_PROMPT },
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, nullable: true },
            total: { type: Type.NUMBER, nullable: true },
            currency: { type: Type.STRING, nullable: true },
            date: {
              type: Type.STRING,
              nullable: true,
              description: 'Date in YYYY-MM-DD format as printed on receipt',
            },
            category: {
              type: Type.STRING,
              enum: [
                'Food & Dining',
                'Groceries',
                'Transport',
                'Shopping',
                'Bills & Utilities',
                'Health',
                'Entertainment',
                'Travel',
                'Other',
              ],
            },
            total_line: {
              type: Type.STRING,
              nullable: true,
              description: 'The exact receipt line from which the total was read, e.g. "GRAND TOTAL  1,240.00"',
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                },
                required: ['name', 'amount'],
              },
            },
          },
          required: ['category'],
        },
      },
    });

    const text = response.text?.trim();
    if (!text) {
      res.status(502).json({ error: 'Empty response returned from Gemini receipt reader' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      res.status(502).json({ error: 'Failed to parse structured JSON from receipt reader' });
      return;
    }

    res.json({
      success: true,
      data: parsed,
      model,
    });
  } catch (error: any) {
    console.error('Error scanning receipt with Gemini:', error);
    res.status(500).json({
      error: error?.message || 'Failed to scan receipt with Gemini',
    });
  }
}
