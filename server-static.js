#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = path.normalize(parsedUrl.pathname);
  
  if (pathname === '/') {
    pathname = '/index.html';
  }

  let filepath = path.join(DIST_DIR, pathname);

  // Security: prevent directory traversal
  if (!filepath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Access denied');
    return;
  }

  fs.stat(filepath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file not found, serve index.html for SPA routing
      filepath = path.join(DIST_DIR, 'index.html');
      fs.stat(filepath, (err, stats) => {
        if (err) {
          res.writeHead(404);
          res.end('404 Not Found');
          return;
        }
        serveFile(filepath, res);
      });
    } else {
      serveFile(filepath, res);
    }
  });
});

function serveFile(filepath, res) {
  const ext = path.extname(filepath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
  console.log(`Serving files from ${DIST_DIR}`);
});
