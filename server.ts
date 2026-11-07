import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import dotenv from 'dotenv';
import { handleScanRequest } from './api/scan.ts';
import { handleAskRequest } from './api/ask.ts';

dotenv.config();

const app = express();
const port = 3000;
const httpsPort = 3443;

// Local HTTPS (mkcert) so iPhone Safari allows the microphone for the voice agent.
// Create the files with: mkcert -cert-file certs/cert.pem -key-file certs/key.pem <your-mac>.local localhost
const certFile = path.resolve('certs', 'cert.pem');
const keyFile = path.resolve('certs', 'key.pem');
const httpsServer =
  fs.existsSync(certFile) && fs.existsSync(keyFile)
    ? https.createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, app)
    : null;

app.use(express.json({ limit: '25mb' }));

// Scan proxy API
app.post('/api/scan', handleScanRequest);

// Voice agent (push-to-talk question -> Gemini tool loop -> spoken answer / draft expense)
app.post('/api/ask', handleAskRequest);

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
    server: {
      middlewareMode: true,
      // Accept the Mac's Bonjour name (e.g. roshans-MacBook-Air.local) from the iPhone.
      allowedHosts: ['.local'],
      // Over HTTPS, hot reload must share the HTTPS server or Safari blocks it as mixed content.
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : httpsServer
            ? { server: httpsServer }
            : true,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

http.createServer(app).listen(port, '0.0.0.0', () => {
  console.log(`Expense Tracker running on http://0.0.0.0:${port}`);
});

if (httpsServer) {
  httpsServer.listen(httpsPort, '0.0.0.0', () => {
    console.log(`Expense Tracker (HTTPS, mic enabled) on https://0.0.0.0:${httpsPort}`);
  });
} else {
  console.log('No certs/cert.pem + certs/key.pem found: HTTPS (needed for the iPhone mic) is off.');
}
