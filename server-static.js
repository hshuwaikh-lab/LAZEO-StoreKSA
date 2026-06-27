#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Try multiple dist locations
const possiblePaths = [
  path.join(__dirname, 'dist'),                              // ./dist
  path.resolve(__dirname, '..', 'dist'),                     // ../dist
  path.resolve(__dirname, 'src', 'dist'),                    // ./src/dist
  path.resolve(__dirname, '..', 'src', 'dist'),              // ../src/dist
  path.resolve('/opt/render/project/src/dist'),              // Render path
  path.resolve('/opt/render/project/dist'),                  // Render root path
];

let DIST_DIR = '';
for (const p of possiblePaths) {
  try {
    if (path.resolve(p)) {
      DIST_DIR = p;
      break;
    }
  } catch {
    continue;
  }
}

const app = express();

// Serve static files with proper caching
app.use(express.static(DIST_DIR, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// SPA routing - fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Express server listening on http://0.0.0.0:${PORT}`);
  console.log(`✓ Serving: ${DIST_DIR}`);
});
