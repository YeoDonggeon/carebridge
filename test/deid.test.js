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
