// 비식별 엔진 회귀 테스트: node --test
// 규칙을 고칠 때 기존에 가리던 항목을 놓치거나 일반 표현을 훼손하지 않는지 확인한다.
// 홀드아웃(testset_holdout.json)은 튜닝 금지 셋이라 여기서 쓰지 않는다.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { deidentify, leakCheck, reidentify } = require('../public/deid.js');

test('정형 개인정보를 유형별 토큰으로 바꾼다', () => {
  const cases = [
    ['연락처 010-2345-6789 입니다', '[전화번호]', '010-2345-6789'],
    ['아들 번호 +84 90 123 4567', '[전화번호]', '+84 90 123 4567'],
    ['주민번호 450312-2123456', '[주민번호]', '450312-2123456'],
    ['메일 family@example.com 로', '[이메일]', 'family@example.com'],
    ['302호 어르신', '[호실]', '302호'],
    ['phòng 115 bị đỏ', '[호실]', 'phòng 115'],
    ['205号房的老人', '[호실]', '205号房'],
    ['생년월일 1941.03.12 확인', '[생년월일]', '1941.03.12'],
  ];
  for (const [text, token, original] of cases) {
    const r = deidentify(text);
    assert.ok(r.masked.includes(token), `${text} → ${r.masked}`);
    assert.ok(!r.masked.includes(original), `원문 잔존: ${r.masked}`);
  }
});

test('관찰 수치와 일반 표현은 보존한다', () => {
  const text = '체온 38.5도, 혈압 150/90, 식사 1/3, 14시에 낙상 직전';
  assert.strictEqual(deidentify(text).masked, text);
});

test('같은 사람은 기록이 달라도 같은 가명을 받는다', () => {
  const a = deidentify('Bà Kim Young-ja ăn ít.');
  const b = deidentify('Kim Young-ja ngủ ngon.', { nameMap: a.nameMap });
  const tok = s => (s.match(/\[어르신[A-Z]+\]/) || [])[0];
  assert.ok(tok(a.masked), a.masked);
  assert.strictEqual(tok(a.masked), tok(b.masked));
});

test('대상자 명부의 다국어 별칭은 같은 가명으로 묶인다', () => {
  const roster = [{ name: '김영자', aliases: ['Young-ja', '金英子'], role: 'resident' }];
  const r1 = deidentify('Young-ja ăn được một nửa', { roster });
  const r2 = deidentify('金英子今天吃得很少', { roster, nameMap: r1.nameMap });
  assert.ok(!r1.masked.includes('Young-ja'), r1.masked);
  assert.ok(!r2.masked.includes('金英子'), r2.masked);
  const tok = s => (s.match(/\[어르신[A-Z]+\]/) || [])[0];
  assert.strictEqual(tok(r1.masked), tok(r2.masked));
});

test('reidentify는 담당자 기기에서 가명을 실명으로 되돌린다', () => {
  const r = deidentify('김영자 어르신이 302호에서 주무심');
  const back = reidentify(r.masked, r.nameMap);
  assert.ok(back.includes('김영자'), back);
});

test('leakCheck는 AI 응답 속 원본 개인정보를 찾아낸다', () => {
  const r = deidentify('Kim Young-ja, SĐT 010-2345-6789');
  assert.deepStrictEqual(leakCheck({ summary_ko: '[어르신A] 식사 저하' }, r.entities), []);
  assert.ok(leakCheck({ summary_ko: '010-2345-6789 로 연락' }, r.entities).length > 0);
});

test('개발셋 기준 성능이 떨어지지 않는다 (재현율 ≥ 98%, 정밀도 100%)', () => {
  const set = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'testset.json'), 'utf8'));
  let total = 0, hit = 0, ents = 0, trueEnts = 0;
  for (const t of set) {
    const r = deidentify(t.text);
    for (const p of t.pii) { total++; if (!r.masked.includes(p)) hit++; }
    for (const e of r.entities) {
      ents++;
      const o = e.original.trim();
      if (t.pii.some(p => o.includes(p) || p.includes(o))) trueEnts++;
    }
  }
  assert.ok((100 * hit / total).toFixed(1) >= 98.0, `재현율 ${(100 * hit / total).toFixed(1)}%`);
  assert.strictEqual(trueEnts, ents, '과잉 가림 발생');
});

// QA 게이트(public/qa.js): 근거 보존·금지표현 점검
const qa = require('../public/qa.js');

test('QA: 인용문이 원문에 있으면 근거 보존, 없으면 실패', () => {
  const src = 'Buổi chiều bà bị chóng mặt, suýt ngã. Uống nước ít, khoảng 2 cốc.';
  assert.ok(qa.isGrounded('bà bị chóng mặt, suýt ngã', src));
  assert.ok(qa.isGrounded('“bị chóng mặt … khoảng 2 cốc”', src), '떨어진 구절을 …로 이은 인용');
  assert.ok(!qa.isGrounded('bà bị sốt cao', src));
  assert.ok(!qa.isGrounded('', src));
});

test('QA: 진단·처방 표현과 잔여 개인정보가 있으면 게이트를 통과하지 못한다', () => {
  const base = { summary_ko: '식사 저하', record: { meal: '죽 1/3 섭취' }, risk_flags: [{ finding: '섭취 저하', action: '섭취량 관찰', evidence_source: 'ăn 1/3' }], pii_residual: [] };
  assert.ok(qa.check(base, 'bà ăn 1/3 bát cháo').pass);
  assert.ok(!qa.check(base, 'bà ăn 1/3 bát cháo', { meal: '탈수로 진단됨' }).pass);
  assert.ok(!qa.check(Object.assign({}, base, { pii_residual: ['Young-ja'] }), 'bà ăn 1/3 bát cháo').pass);
});

test('QA: 데모 예시 결과는 모두 게이트를 통과한다', () => {
  global.window = {};
  require('../public/demo-data.js');
  const demo = global.window.CB_DEMO;
  assert.ok(demo.length >= 4);
  for (const s of demo) {
    const d = deidentify(s.memo);
    const name = (d.entities.find(e => e.type === 'NAME') || {}).token || '[어르신A]';
    const res = JSON.parse(JSON.stringify(s.result).split('{{N}}').join(name).split('{{R}}').join('[호실]'));
    const r = qa.check(res, d.masked);
    assert.ok(r.pass, s.label + ' → ' + r.checks.filter(c => !c.ok).map(c => c.detail).join(' / '));
  }
});

// 빠른 선택(public/quick.js): 객관식 문구가 메모에 들어가고, 비식별 엔진이 그 문구를 개인정보로 오인하지 않아야 한다
const quick = require('../public/quick.js');

test('빠른 선택: 항목당 하나만 선택되고 다시 누르면 지워진다', () => {
  const meal = quick.CATS.find(c => c.key === 'meal');
  let memo = quick.toggle('', meal, meal.opts[1], 'vi');
  assert.strictEqual(memo, 'Ăn uống: Ăn một nửa');
  memo = quick.toggle(memo + '\nBà vui vẻ.', meal, meal.opts[3], 'vi');
  assert.ok(!memo.includes('Ăn một nửa') && memo.includes('Ăn uống: Không chịu ăn') && memo.includes('Bà vui vẻ.'), memo);
  assert.ok(quick.isOn(memo, meal, meal.opts[3], 'vi'));
  memo = quick.toggle(memo, meal, meal.opts[3], 'vi');
  assert.strictEqual(memo, 'Bà vui vẻ.');
});

test('빠른 선택: 어떤 언어의 선택 문구도 비식별에서 가려지지 않는다', () => {
  for (const lang of ['ko', 'vi', 'zh', 'en']) {
    for (const c of quick.CATS) for (const o of c.opts) {
      const l = quick.line(c, o, lang);
      assert.strictEqual(deidentify(l).masked, l, `${lang}: ${l}`);
    }
  }
});
