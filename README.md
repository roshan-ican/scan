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

Install dependencies with bun (it follows `bun.lock`; plain `npm install` currently stops on an esbuild peer-version conflict):
```bash
bun install
```

Run the development server (Express API on `/api/scan` and `/api/ask`, Vite app on port 3000, plus HTTPS on 3443 when `certs/` exists):
```bash
npm run dev
```

Run unit tests (scan results, money formatting, expense queries):
```bash
npm test
```

Build for production:
```bash
npm run build
npm start
```

---

## Ask: the voice agent

Open the **Ask** tab (or `/ask`), hold **Hold to ask**, speak, and let go.

- **Questions**: "How much did I spend on food this month?", "What was my biggest expense last week?", "How does this month compare with October?". Follow-ups like "and last month?" work.
- **Adding by voice**: "I spent 250 on lunch at Subway" shows a filled-in expense card. Nothing is saved until you tap **Save** (or Edit it first, or Discard).
- Answers are read aloud (use the speaker button to mute) and work by typing too (keyboard button).

How it works: the phone records 16 kHz WAV and sends it with a compact copy of your expenses to `POST /api/ask`. Gemini answers through two tools: `query_expenses`, which the server runs exactly over your rows (`src/lib/expenseQuery.ts`, the same code Home uses, so numbers always match), and `respond`, which returns what it heard, the spoken answer and an optional draft expense.

> **Privacy**: asking a question sends your expense list (date, amount, category, store, note) to Gemini, not just receipt photos.

## Running it on your iPhone (local HTTPS)

iPhone Safari only allows the microphone on HTTPS, and the app's saved data is tied to the address, so use one fixed HTTPS address: your Mac's Bonjour name.

1. Put your key in `.env` (never commit it; `.env*` is git-ignored):
   ```bash
   GEMINI_API_KEY="your-key-from-aistudio.google.com"
   ```
2. Create the certificate (once; `certs/` is git-ignored):
   ```bash
   brew install mkcert
   mkcert -cert-file certs/cert.pem -key-file certs/key.pem "$(scutil --get LocalHostName).local" localhost 127.0.0.1
   ```
3. Trust mkcert's root on the iPhone (once): AirDrop `"$(mkcert -CAROOT)/rootCA.pem"` to the phone, then **Settings → General → VPN & Device Management** → install the profile, then **Settings → General → About → Certificate Trust Settings** → turn on full trust for "mkcert …". (Optional, for the Mac's own browsers: `mkcert -install`.)
4. `npm run dev`, then open `https://<your-mac>.local:3443` in Safari on the iPhone (Mac and phone on the same Wi-Fi or hotspot). If `.local` doesn't resolve, add the Mac's IP to the `mkcert` command and use `https://<ip>:3443`.
5. Shortcuts: point **Open URLs** at `https://<your-mac>.local:3443/ask` (or `/scan`, `/add`) and attach it to Back Tap or the Action Button as described above.

Data saved at a different address (for example `http://<ip>:3000`) stays with that address; move it with **Settings → Export JSON / Import**.

---

## Phase 2 Roadmap
- **Apple Wallet Passes**: Generation of signed `.pkpass` files containing receipt barcodes and store metadata (requires Apple Developer Program Team ID and Pass Type Certificate).
