// 로컬 실행용 서버 (의존성 없음):  GEMINI_API_KEY=xxx node server.js  → http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./api/ai.js');

// .env 파일이 있으면 읽기
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (_) {}

const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/ai') {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      req.body = raw ? JSON.parse(raw) : {};
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
      handler(req, res);
    });
    return;
  }
  let p = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!p.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
  fs.readFile(p, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache'); // 로컬에서 수정한 파일이 새로고침 즉시 반영되도록
    res.end(buf);
  });
}).listen(process.env.PORT || 3000, () => {
  console.log(`CareBridge → http://localhost:${process.env.PORT || 3000}  (AI ${process.env.GEMINI_API_KEY ? '연결' : '미연결: 데모 모드'})`);
});
