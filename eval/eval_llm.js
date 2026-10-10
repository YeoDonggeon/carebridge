// 생성형 AI 구조화 품질 사전검증
//   GEMINI_API_KEY=xxx node eval/eval_llm.js            (testset.json 전체)
//   GEMINI_API_KEY=xxx node eval/eval_llm.js 10         (앞 10건만)
//   EVAL_TAG=v2 EVAL_SLEEP_MS=13000 node eval/eval_llm.js   (results_llm_v2.json 으로 저장, 요청 간격 13초)
// 한 모델의 품질만 재도록 대체 모델 전환을 끈다(GEMINI_NO_FALLBACK). 모델은 GEMINI_MODEL로 지정.
// 측정 항목
//  1) JSON 유효율      : 스키마대로 파싱·정규화된 비율
//  2) 위험신호 재현율   : 정답(expect)에 있는 위험 수준·키워드를 AI가 같은 수준으로 표시한 비율
//  3) 과잉경보         : 정답에 위험이 없는데 urgent를 낸 건수
//  4) 수치 충실도      : AI가 쓴 숫자가 원문에 존재하는 비율(환각 수치 탐지)
//     원문이 숫자를 단어로 쓴 경우('세 번', '三天', 'hai lần')도 같은 수로 인정한다.
//     단어 정규화 없이 숫자 글자만 비교한 값은 numeric_fidelity_strict 로 함께 남긴다.
//  5) 개인정보 누출    : 비식별 후 AI 출력에 원본 PII가 나타난 건수
//  6) 평균 응답시간
//  7) 근거 보존율      : 위험 신호의 인용문(evidence_source)이 AI에 보낸 원문에 그대로 있는 비율
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
const { isGrounded } = require('../public/qa.js');

const LIMIT = parseInt(process.argv[2] || '0', 10);
const TAG = process.env.EVAL_TAG ? '_' + process.env.EVAL_TAG : '';
const SLEEP_MS = parseInt(process.env.EVAL_SLEEP_MS || '13000', 10); // 무료 티어 분당 5회 한도 고려
process.env.GEMINI_NO_FALLBACK = '1';
let set = JSON.parse(fs.readFileSync(path.join(__dirname, 'testset.json'), 'utf8'));
if (LIMIT) set = set.slice(0, LIMIT);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nums = s => (String(s).match(/\d+(?:[.,/]\d+)?/g) || []);
// 원문에 숫자 단어로 적힌 수(1~10). 한국어 고유어·한자, 중국어, 베트남어, 영어, 인도네시아어, 필리핀어, 러시아어, 네팔어(1~5)
const WORD_NUMS = [
  [1, /한\s?(번|차례|개|컵|잔|그릇|시간|알|명)|하루|一|một|\bone\b|\bonce\b|\bsatu\b|sekali|\bisa(ng)?\b|один|одна|раз\b|एक/i],
  [2, /두\s?(번|차례|개|컵|잔|그릇|시간|알|명)|이틀|二|两|兩|\bhai\b|\btwo\b|\btwice\b|\bdua\b|dalawa|два|две|дважды|दुई/i],
  [3, /세\s?(번|차례|개|컵|잔|그릇|시간|알|명)|사흘|三|\bba\b|\bthree\b|\btiga\b|tatlo|три|трижды|तीन/i],
  [4, /네\s?(번|차례|개|컵|잔|그릇|시간|알|명)|나흘|四|\bbốn\b|\bfour\b|\bempat\b|\bapat\b|четыре|चार/i],
  [5, /다섯|닷새|五|\bnăm\b|\bfive\b|\blima\b|пять|पाँच/i],
  [6, /여섯|六|\bsáu\b|\bsix\b|\benam\b|\banim\b|шесть/i],
  [7, /일곱|七|\bbảy\b|\bseven\b|\btujuh\b|\bpito\b|семь/i],
  [8, /여덟|八|\btám\b|\beight\b|\bdelapan\b|\bwalo\b|восемь/i],
  [9, /아홉|九|\bchín\b|\bnine\b|\bsembilan\b|\bsiyam\b|девять/i],
  [10, /열\s?(번|개|시간)|十|\bmười\b|\bten\b|\bsepuluh\b|sampu|десять/i]
];
const wordNums = s => WORD_NUMS.filter(([, re]) => re.test(s)).map(([n]) => String(n));

(async () => {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY 가 필요합니다 (.env 또는 환경변수).'); process.exit(1); }
  const rows = [];
  let ok = 0, expTotal = 0, expHit = 0, falseUrgent = 0, numTotal = 0, numOk = 0, numOkStrict = 0, leaks = 0, ms = 0, evTotal = 0, evOk = 0;
  for (const t of set) {
    const d = deidentify(t.text);
    let out, err = null;
    try { out = await runTask({ task: 'structure', text: d.masked, lang: t.lang }, process.env); ok++; }
    catch (e) { err = e.message; }
    const row = { id: t.id, lang: t.lang, error: err };
    if (out) row.model = out._meta.model;
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
      const ungrounded = flags.filter(f => !isGrounded(f.evidence_source, d.masked));
      evTotal += flags.length; evOk += flags.length - ungrounded.length;
      if (ungrounded.length) { row.ungrounded = ungrounded.map(f => f.evidence_source); row.source = d.masked; }
      const srcNums = new Set(nums(d.masked));
      const outNums = nums(Object.values(out.record).join(' '));
      const numMiss = [];
      const srcWords = new Set(wordNums(d.masked));
      outNums.forEach(n => {
        numTotal++;
        const strict = srcNums.has(n) || [...srcNums].some(s => s.indexOf(n) !== -1);
        if (strict) numOkStrict++;
        if (strict || srcWords.has(n)) numOk++; else numMiss.push(n);
      });
      if (numMiss.length) { row.num_miss = numMiss; row.record = out.record; row.source = d.masked; } // 실패 유형 분석용
      const lk = leakCheck(out, d.entities); if (lk.length) { leaks++; row.leak = lk; }
      row.summary = out.summary_ko;
    }
    rows.push(row);
    process.stdout.write(`${t.id} ${err ? '✗ ' + err : '✓ ' + row.summary}\n`);
    await sleep(SLEEP_MS);
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
  const summary = {
    model: Array.from(new Set(rows.map(r => r.model).filter(Boolean))).join(', ') || process.env.GEMINI_MODEL || '-',
    samples: set.length,
    json_valid: pct(ok, set.length),
    risk_recall: pct(expHit, expTotal),
    false_urgent: falseUrgent,
    numeric_fidelity: pct(numOk, numTotal),
    numeric_fidelity_strict: pct(numOkStrict, numTotal),
    evidence_grounded: pct(evOk, evTotal),
    pii_leak_cases: leaks,
    avg_latency_sec: ok ? (ms / ok / 1000).toFixed(2) : '-'
  };
  console.log('\n=== 생성형 AI 구조화 사전검증 ===');
  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(__dirname, 'results_llm' + TAG + '.json'), JSON.stringify({ summary, rows }, null, 2));
  console.log('→ eval/results_llm' + TAG + '.json 저장');
})();
