/*
 * CareBridge QA 게이트 (브라우저 · Node 공용)
 * 원 아이디어 제안서의 "QA 게이트: 근거 보존 · 금지표현 · 자동 공유 차단 점검"을 구현한다.
 * AI 초안이 담당자 검토와 가족 공유로 넘어가기 전에 기계적으로 확인할 수 있는 것만 본다.
 */
(function (root) {
  'use strict';

  // 진단·처방으로 읽힐 수 있는 표현. AI 초안과 담당자가 고친 문장 모두에 적용한다.
  const FORBIDDEN = ['진단', '처방', '확진', '약을 늘', '약을 줄', '용량을 늘', '용량을 줄', '투약을 중단', '복용을 중단', '응급이 아님', '응급 아님'];

  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  /** 인용문이 원문에 그대로 있는지. AI가 "A … B"처럼 떨어진 구절을 이어 인용한 경우 조각별로 확인한다. */
  function isGrounded(evidence, source) {
    const src = norm(source);
    const parts = norm(evidence).split(/\s*(?:…|\.{3,})\s*/).map(p => p.replace(/^[\s"'“”‘’.,;:·]+|[\s"'“”‘’.,;:·]+$/g, '')).filter(Boolean);
    if (!parts.length) return false;
    return parts.every(p => src.indexOf(p) !== -1);
  }

  /**
   * @param {object} result AI 구조화 결과
   * @param {string} source AI에 보낸 비식별 원문
   * @param {object} [draft] 담당자가 수정 중인 기록(없으면 result.record)
   * @returns {{pass:boolean, checks:Array<{key,label,ok,detail}>}}
   */
  function check(result, source, draft) {
    const flags = (result && result.risk_flags) || [];
    const ungrounded = flags.filter(f => !isGrounded(f.evidence_source, source));
    const texts = Object.values(draft || (result && result.record) || {})
      .concat(flags.map(f => f.finding + ' ' + f.action), [result && result.summary_ko]);
    const banned = FORBIDDEN.filter(w => texts.some(t => String(t || '').indexOf(w) !== -1));
    const pii = (result && result.pii_residual) || [];
    const checks = [
      { key: 'evidence', label: '근거 보존', ok: ungrounded.length === 0,
        detail: flags.length ? (ungrounded.length ? `위험 신호 ${flags.length}건 중 ${ungrounded.length}건의 인용문이 원문에 없습니다.` : `위험 신호 ${flags.length}건 모두 원문 인용 확인`) : '위험 신호 없음' },
      { key: 'forbidden', label: '금지표현', ok: banned.length === 0,
        detail: banned.length ? `진단·처방으로 읽힐 수 있는 표현: ${banned.join(', ')}` : '진단·처방 표현 없음' },
      { key: 'pii', label: '개인정보', ok: pii.length === 0,
        detail: pii.length ? `가려지지 않은 개인정보 의심: ${pii.join(', ')}` : '잔여 개인정보 없음' }
    ];
    return { pass: checks.every(c => c.ok), checks };
  }

  const api = { check, isGrounded, FORBIDDEN };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CBQa = api;
})(typeof self !== 'undefined' ? self : this);
