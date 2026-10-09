// 비식별화 모듈 사전검증: node eval/eval_deid.js
// - 재현율(Recall): 정답 개인정보 중 가려진 비율 (놓치면 개인정보 유출)
// - 정밀도(Precision): 가린 항목 중 실제 개인정보인 비율 (과잉 가림은 의미 손실)
// - 보존율: 반드시 남아야 할 일반 표현(수치·호칭 등)이 훼손되지 않은 비율
'use strict';
const fs = require('fs');
const path = require('path');
const { deidentify } = require('../public/deid.js');

const FILE = process.argv[2] || 'testset.json';
const set = JSON.parse(fs.readFileSync(path.join(__dirname, FILE), 'utf8'));
let piiTotal = 0, piiHit = 0, entTotal = 0, entTrue = 0, keepTotal = 0, keepOk = 0;
const byLang = {};
const fails = [];

for (const t of set) {
  const r = deidentify(t.text);
  const L = (byLang[t.lang] = byLang[t.lang] || { pii: 0, hit: 0, n: 0 });
  L.n++;
  for (const p of t.pii) {
    piiTotal++; L.pii++;
    if (r.masked.indexOf(p) === -1) { piiHit++; L.hit++; } else fails.push({ id: t.id, kind: 'MISS(미가림)', value: p, note: t.note || '' });
  }
  for (const e of r.entities) {
    entTotal++;
    const o = e.original.trim();
    if (t.pii.some(p => o.indexOf(p) !== -1 || p.indexOf(o) !== -1)) entTrue++;
    else fails.push({ id: t.id, kind: 'OVER(과잉)', value: o, note: t.note || '' });
  }
  for (const k of t.keep) {
    keepTotal++;
    if (r.masked.indexOf(k) !== -1) keepOk++; else fails.push({ id: t.id, kind: 'BROKEN(보존실패)', value: k, note: t.note || '' });
  }
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
const recall = piiHit / piiTotal, precision = entTrue / entTotal;
const summary = {
  samples: set.length,
  languages: Object.keys(byLang).length,
  pii_items: piiTotal,
  recall: pct(piiHit, piiTotal),
  precision: pct(entTrue, entTotal),
  f1: (100 * 2 * recall * precision / (recall + precision)).toFixed(1) + '%',
  keep_rate: pct(keepOk, keepTotal),
  by_language: Object.fromEntries(Object.entries(byLang).map(([k, v]) => [k, { samples: v.n, recall: pct(v.hit, v.pii) }]))
};
console.log('=== CareBridge 비식별화 사전검증 ===');
console.log(JSON.stringify(summary, null, 2));
console.log('\n--- 실패 사례 ---');
fails.forEach(f => console.log(`${f.id}\t${f.kind}\t${f.value}\t${f.note}`));
fs.writeFileSync(path.join(__dirname, FILE.replace('testset', 'results_deid')), JSON.stringify({ summary, fails }, null, 2));
