#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
// Look for dist in the root directory
const DIST_DIR = fs.existsSync(path.join(__dirname, 'dist')) 
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, '..', 'dist');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon'
};

function sendFile(filepath, res) {
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Server Error');
      return;
    }

    const ext = path.extname(filepath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let pathname = req.url.split('?')[0];
  
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Remove leading slash and join with DIST_DIR
  let filepath = path.join(DIST_DIR, pathname);

  // Security: prevent directory traversal
  const realpath = path.resolve(filepath);
  const distpath = path.resolve(DIST_DIR);
  if (!realpath.startsWith(distpath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Try to serve the requested file
  fs.stat(filepath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(filepath, res);
    } else {
      // For SPA: serve index.html for routes that don't match static files
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.stat(indexPath, (err, stats) => {
        if (!err && stats.isFile()) {
          sendFile(indexPath, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        }
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Static server listening on http://0.0.0.0:${PORT}`);
  console.log(`✓ Serving: ${DIST_DIR}`);
});
