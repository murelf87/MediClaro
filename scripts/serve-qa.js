#!/usr/bin/env node
// Servidor estático (con vuelta a index.html) para la build web de QA. SOLO DESARROLLO.
// Uso: node scripts/serve-qa.js <carpeta-de-la-build> [puerto]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist-qa');
const port = Number(process.argv[3] || 8765);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml',
};
http
  .createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = path.resolve(root, '.' + p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, '127.0.0.1', () => console.log(`QA en http://localhost:${port} (${root})`));
