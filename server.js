const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE = __dirname;

const mimeTypes = {
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  let filePath = path.join(BASE, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).slice(1);
  const contentType = mimeTypes[ext] || 'text/plain';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(PORT, () => {
  console.log('CRM running on http://localhost:' + PORT);
});
