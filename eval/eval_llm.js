// 생성형 AI 구조화 품질 사전검증
//   GEMINI_API_KEY=xxx node eval/eval_llm.js            (testset.json 전체)
//   GEMINI_API_KEY=xxx node eval/eval_llm.js 10         (앞 10건만)
// 측정 항목
//  1) JSON 유효율      : 스키마대로 파싱·정규화된 비율
//  2) 위험신호 재현율   : 정답(expect)에 있는 위험 수준·키워드를 AI가 같은 수준으로 표시한 비율
//  3) 과잉경보         : 정답에 위험이 없는데 urgent를 낸 건수
//  4) 수치 충실도      : AI가 쓴 숫자가 원문에 존재하는 비율(환각 수치 탐지)
//  5) 개인정보 누출    : 비식별 후 AI 출력에 원본 PII가 나타난 건수
//  6) 평균 응답시간
'use strict';
const fs = require('fs');
const path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
} catch (_) {}
const { runTask } = require('../lib/core.js');
const { deidentify, leakCheck } = require('../public/deid.js');

const LIMIT = parseInt(process.argv[2] || '0', 10);
let set = JSON.parse(fs.readFileSync(path.join(__dirname, 'testset.json'), 'utf8'));
if (LIMIT) set = set.slice(0, LIMIT);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nums = s => (String(s).match(/\d+(?:[.,/]\d+)?/g) || []);

(async () => {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY 가 필요합니다 (.env 또는 환경변수).'); process.exit(1); }
  const rows = [];
  let ok = 0, expTotal = 0, expHit = 0, falseUrgent = 0, numTotal = 0, numOk = 0, leaks = 0, ms = 0;
  for (const t of set) {
    const d = deidentify(t.text);
    let out, err = null;
    try { out = await runTask({ task: 'structure', text: d.masked, lang: t.lang }, process.env); ok++; }
    catch (e) { err = e.message; }
    const row = { id: t.id, lang: t.lang, error: err };
    if (out) {
      ms += out._meta.ms;
      const flags = out.risk_flags;
      const exp = t.expect || {};
      row.expected = exp; row.got = flags.map(f => f.level + ':' + f.finding);
      for (const lv of Object.keys(exp)) {
        for (const kw of exp[lv]) {
          expTotal++;
          const hit = flags.some(f => (lv === 'observe' ? true : f.level === lv || (lv === 'caution' && f.level === 'urgent')) && (f.finding + f.category + f.action).indexOf(kw) !== -1);
          if (hit) expHit++;
        }
      }
      if (!exp.urgent && flags.some(f => f.level === 'urgent')) { falseUrgent++; row.false_urgent = true; }
      const srcNums = new Set(nums(d.masked));
      const outNums = nums(Object.values(out.record).join(' '));
      outNums.forEach(n => { numTotal++; if (srcNums.has(n) || [...srcNums].some(s => s.indexOf(n) !== -1)) numOk++; });
      const lk = leakCheck(out, d.entities); if (lk.length) { leaks++; row.leak = lk; }
      row.summary = out.summary_ko;
    }
    rows.push(row);
    process.stdout.write(`${t.id} ${err ? '✗ ' + err : '✓ ' + row.summary}\n`);
    await sleep(4500); // 무료 티어 분당 요청 제한 고려
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
  const summary = {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    samples: set.length,
    json_valid: pct(ok, set.length),
    risk_recall: pct(expHit, expTotal),
    false_urgent: falseUrgent,
    numeric_fidelity: pct(numOk, numTotal),
    pii_leak_cases: leaks,
    avg_latency_sec: ok ? (ms / ok / 1000).toFixed(2) : '-'
  };
  console.log('\n=== 생성형 AI 구조화 사전검증 ===');
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(__dirname, 'results_llm.json'), JSON.stringify({ summary, rows }, null, 2));
  console.log('→ eval/results_llm.json 저장');
})();
