import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { handleScanRequest } from './api/scan.ts';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '25mb' }));

// Scan proxy API
app.post('/api/scan', handleScanRequest);

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve('.', 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve('.', 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Expense Tracker running on http://0.0.0.0:${port}`);
});
