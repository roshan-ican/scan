# Expense Tracker — iPhone Web App

A personal expense tracker built for mobile-first speed with one-tap entry from iOS Shortcuts, Back Tap, or your home screen.

## Highlights
- **Two ways to add an expense**:
  1. **Type**: Fast custom 3×4 numeric keypad (64px touch targets), category chips, note, and timestamp.
  2. **Scan**: Single Gemini call (`gemini-3.8-flash`) extracts merchant, grand total after taxes and discounts, date, and suggested category with structured JSON.
- **The Receipt Line as Proof**: Displays the exact printed receipt text line (e.g. `GRAND TOTAL 1,240.00`) directly beside the thumbnail so you can verify why that total was chosen.
- **Client-Side Storage**: Kept securely on your device in IndexedDB via Dexie. No expense history is sent to any server; only receipt images are sent to the Gemini scan proxy.
- **Persistent Storage**: Calls `navigator.storage.persist()` to keep data safely retained in Safari.
- **Export & Import**: Download JSON backup or CSV spreadsheet anytime from Settings.
- **Responsive**: Mobile-first iPhone experience (< 768px) with bottom tab bar; scales gracefully to tablet/desktop (>= 768px) with a vertical icon rail and two-column summary and expense feed.

---

## Getting Your Gemini API Key from Google AI Studio

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** → **Create API key**.
4. Copy the API key and paste it into your `.env` file (or AI Studio Secrets panel):
   ```bash
   GEMINI_API_KEY="your-api-key-here"
   GEMINI_MODEL="gemini-3.8-flash"
   ```
> **Note on Free Tier**: Google AI Studio provides a free tier for personal use. On the free tier, data may be used to improve Google products. If you prefer zero data retention for receipts, link a billing account to switch the project to paid in Google Cloud Console.

---

## One-Tap iPhone Setup (Shortcuts, Back Tap & Action Button)

Because Safari and Home Screen Web Apps keep isolated IndexedDB storage, using the same Shortcut ensures all expenses stay in one consolidated database.

### 1. Create the Shortcut
1. Open the **Shortcuts** app on your iPhone.
2. Tap **+** in the top right corner to create a new shortcut.
3. Tap **Add Action** → search for **Open URLs**.
4. Enter your app's scan or add URL:
   - For instant receipt scan: `https://<your-app-domain>/scan`
   - For instant typed keypad: `https://<your-app-domain>/add`
5. Name the shortcut **"Scan Receipt"** or **"Add Expense"** and choose an icon.

### 2. Attach to Back Tap (Double or Triple Tap)
1. On your iPhone, open **Settings**.
2. Tap **Accessibility** → **Touch**.
3. Scroll down to the bottom and select **Back Tap**.
4. Select **Double Tap** (or **Triple Tap**).
5. Scroll down to the **Shortcuts** section and select your **Scan Receipt** shortcut.
6. Now tap the back of your iPhone twice to open the scanner instantly!

### 3. Attach to iPhone Action Button (iPhone 15 Pro / 16)
1. Open **Settings** → **Action Button**.
2. Swipe to the **Shortcut** option.
3. Select your **Scan Receipt** shortcut.

---

## Development

Run development server (serves Express API proxy on `/api/scan` and Vite app on port 3000):
```bash
npm run dev
```

Run unit tests:
```bash
npm test
```

Build for production:
```bash
npm run build
npm start
```

---

## Phase 2 Roadmap
- **Apple Wallet Passes**: Generation of signed `.pkpass` files containing receipt barcodes and store metadata (requires Apple Developer Program Team ID and Pass Type Certificate).
