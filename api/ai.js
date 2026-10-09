// Vercel 서버리스 함수: POST /api/ai  (GET: 상태 확인)
'use strict';
const { runTask } = require('../lib/core.js');

// 간단한 IP별 요청 제한(인스턴스 메모리 기준) — 공개 데모 URL 남용 방지
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 12; // 분당 12회
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, configured: !!process.env.GEMINI_API_KEY });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'local';
  if (limited(ip)) return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    const out = await runTask(body, process.env);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e) });
  }
};
