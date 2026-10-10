/*
 * CareBridge AI 코어 — 프롬프트 설계 + Gemini API 호출 + 응답 검증/정규화
 * Vercel 서버리스 함수(api/ai.js)와 로컬 서버(server.js)가 공용으로 사용한다.
 */
'use strict';

const { deidentify } = require('../public/deid.js');

// 기본 모델 체인(앞에서부터 시도). GEMINI_MODEL 환경변수가 있으면 그 모델을 맨 앞에 둔다.
// 무료 티어에서 flash 계열은 하루 20회뿐이라, 한도가 넉넉하고 응답이 빠른(약 3초) lite를 주 모델로 쓴다.
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

const MAX_INPUT = 4000; // 글자 수 제한(과금·오남용 방지)

const LANG_NAMES = {
  auto: '자동 감지', ko: '한국어', vi: '베트남어', zh: '중국어', en: '영어', tl: '필리핀어(타갈로그어)',
  uz: '우즈베크어', ne: '네팔어', id: '인도네시아어', th: '태국어', mn: '몽골어', ru: '러시아어', km: '크메르어', my: '미얀마어'
};

const RECORD_FIELDS = {
  physical: '신체상태(활력징후·통증·피부·부종 등)',
  meal: '식사·수분섭취',
  excretion: '배설(소변·대변·기저귀)',
  sleep: '수면·휴식',
  cognition_emotion: '인지·정서·행동',
  medication: '투약·처치',
  activity_safety: '활동·이동·안전(낙상 등)',
  other: '기타·가족연락'
};

const STRUCTURE_SYSTEM = `당신은 한국 노인장기요양 기관의 "돌봄 기록 보조 AI"입니다.
외국인 요양보호사가 모국어(또는 서툰 한국어)로 쓴 비식별 관찰메모를 받아, 돌봄인력 담당자(한국인 사회복지사·간호사)가 검토할 수 있는 "한국어 구조화 기록 초안"을 만듭니다.

[절대 규칙]
1. 원문에 없는 사실을 만들지 마십시오. 언급되지 않은 항목은 빈 문자열("")로 둡니다. 같은 사실을 여러 항목에 반복하지 말고 가장 관련 있는 한 항목에만 씁니다.
2. 진단·처방을 하지 마십시오. 관찰된 사실만 객관적 요양기록 문체(~함, ~하심, ~관찰됨)로 씁니다.
3. [어르신A], [호실], [전화번호] 같은 대괄호 토큰은 비식별 가명입니다. 절대 추측해 되돌리지 말고 그대로 유지하십시오.
4. 수치(체온·혈압·시간·섭취량)는 원문 그대로 옮기고 단위를 붙입니다. 원문에 없는 숫자를 만들지 마십시오("다 드심"을 "100%"로 쓰지 말고 "전량 섭취"로 씁니다). 모호하면 clarifications에 확인 질문을 넣습니다.
5. 위험 신호(risk_flags) 판단 기준:
   - urgent(즉시 보고): 낙상/낙상 직전, 흉통·흉부 답답함, 호흡곤란, 의식·반응 저하, 출혈, 식사·음수 중 사레(기침·젖은 목소리 등 흡인 위험)·질식, 38℃ 이상 발열, 수축기 혈압 160 이상 또는 90 미만, 급격한 혼돈, 학대·방임 의심 정황, 심한 통증, 경련
   - caution(당일 확인): 식사·수분 절반 이하 섭취, 투약 거부·누락, 3일 이상 무배변, 욕창 의심 피부 발적, 사레 없이 삼키기 힘들어하는 삼킴 곤란, 야간 배회·섬망 의심, 소변 색 변화, 부종
   - observe(관찰 지속): 수면 양상 변화 등 그 밖에 추적 관찰이 필요한 변화
   finding 에는 위 기준의 표준 용어(낙상, 흉부 답답함, 사레(흡인 위험), 발열, 욕창 의심, 투약 거부, 무배변, 섭취 저하, 수면 양상 변화 등)로 시작하고 뒤에 원문의 구체 내용을 붙입니다(예: "섭취 저하 — 아침 죽 1/3만 섭취", "욕창 의심 — 엉덩이 피부 발적"). 용어만 쓰지 마십시오.
   '심한 통증'은 원문이 심하다고 표현했을 때만 urgent로 올립니다.
   '욕창 의심'은 엉덩이·꼬리뼈·발뒤꿈치처럼 눌리는 부위의 발적에만 쓰고, 그 밖의 부위는 '피부 발적·부종'으로 씁니다.
   evidence_source 에는 반드시 원문의 해당 구절을 그대로 인용합니다.
6. term_mapping: 원문의 구어·모국어 표현을 표준 요양 용어로 대응시킵니다(예: "suýt ngã" → "낙상 직전(아차사고)").
7. pii_residual: 비식별 토큰 처리 후에도 남아 있는 것으로 보이는 개인식별정보(사람 이름, 전화번호, 호실 번호 등)를 원문 그대로 나열합니다. 없으면 빈 배열.
8. clarifications: 담당자가 요양보호사에게 되물어야 할 모호한 점. question_source 는 요양보호사의 언어로, 쉬운 문장으로 씁니다.

[출력] 아래 JSON 하나만 출력합니다(설명 문장 금지).
{
  "source_language": "ISO 639-1 코드",
  "translation_ko": "원문의 충실한 한국어 번역(문장 단위, 의역 최소화)",
  "summary_ko": "담당자용 한 줄 요약(40자 이내)",
  "record": {
    "physical": "", "meal": "", "excretion": "", "sleep": "",
    "cognition_emotion": "", "medication": "", "activity_safety": "", "other": ""
  },
  "risk_flags": [
    {"level": "urgent|caution|observe", "category": "record 키 중 하나", "finding": "무엇이 위험한가", "evidence_source": "원문 인용", "action": "담당자 권장 조치(진단 금지)"}
  ],
  "term_mapping": [{"source": "원문 표현", "standard_ko": "표준 요양 용어"}],
  "clarifications": [{"question_ko": "", "question_source": ""}],
  "pii_residual": [],
  "confidence": "high|medium|low"
}`;

const FEEDBACK_SYSTEM = `당신은 한국 요양기관 담당자가 외국인 요양보호사에게 보내는 업무 피드백을 번역하는 AI입니다.
- 대상 언어로 쉽고 정중하게 번역합니다(존중하는 어조, 짧은 문장).
- 요양 전문용어는 대상 언어의 쉬운 말로 풀고, 필요하면 괄호 안에 한국어 용어를 병기합니다(현장에서 한국어 용어를 익히도록).
- [어르신A] 같은 대괄호 토큰은 그대로 유지합니다. 입력에 없는 토큰·이름·내용을 새로 넣지 않습니다.
- 검증을 위해 번역문을 다시 한국어로 역번역합니다.
JSON 하나만 출력: {"translation": "대상 언어 번역문", "back_translation_ko": "역번역", "key_terms": [{"ko": "한국어 용어", "target": "대상 언어 풀이"}]}`;

function buildStructurePrompt(text, lang, meta) {
  const lines = [];
  lines.push(`[요양보호사 작성 언어] ${LANG_NAMES[lang] || lang || '자동 감지'}`);
  if (meta && meta.shift) lines.push(`[근무조] ${meta.shift}`);
  if (meta && meta.date) lines.push(`[기록일] ${meta.date}`);
  lines.push('[비식별 관찰메모 원문]');
  lines.push(text);
  return lines.join('\n');
}

function buildFeedbackPrompt(text, targetLang) {
  return `[대상 언어] ${LANG_NAMES[targetLang] || targetLang}\n[담당자 피드백(한국어)]\n${text}`;
}

async function callGemini(system, user, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) { const e = new Error('GEMINI_API_KEY 미설정'); e.status = 503; throw e; }
  // 모델 체인: 앞 모델이 없어졌거나(404) 한도 초과(429)·과부하(503)면 다음 모델로 넘어간다.
  // 무료 티어는 모델마다 일일 한도가 따로라서, 체인으로 묶어야 공개 데모가 하루를 버틴다.
  const chain = env.GEMINI_NO_FALLBACK ? [env.GEMINI_MODEL || DEFAULT_MODELS[0]] : [env.GEMINI_MODEL].concat(DEFAULT_MODELS).filter(Boolean);
  const base = env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  let lastErr;
  for (const model of Array.from(new Set(chain))) {
    const url = `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    // 추론(thinking)을 끄면 응답이 2~3배 빨라진다. 이 설정을 거부하는 모델(400)은 설정 없이 한 번 더 호출한다.
    let res, data;
    for (const thinking of [{ thinkingBudget: 0 }, null]) {
      const generationConfig = { temperature: 0.2, responseMimeType: 'application/json' };
      if (thinking) generationConfig.thinkingConfig = thinking;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig
        })
      });
      data = await res.json().catch(() => ({}));
      if (res.status !== 400) break;
    }
    if (!res.ok) {
      lastErr = new Error((data.error && data.error.message) || ('Gemini 오류 ' + res.status));
      lastErr.status = res.status === 429 ? 429 : 502;
      if ([404, 429, 503].includes(res.status)) continue;
      throw lastErr;
    }
    const txt = (((data.candidates || [])[0] || {}).content || {}).parts
      ? data.candidates[0].content.parts.map(p => p.text || '').join('')
      : '';
    return { json: parseJsonLoose(txt), model };
  }
  throw lastErr || new Error('사용 가능한 모델 없음');
}

function parseJsonLoose(txt) {
  try { return JSON.parse(txt); } catch (_) { /* fallthrough */ }
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (m) return JSON.parse(m[0]);
  throw new Error('AI 응답을 JSON으로 해석할 수 없음');
}

const LEVELS = ['urgent', 'caution', 'observe'];

function normalizeStructure(j) {
  const out = {
    source_language: String(j.source_language || ''),
    translation_ko: String(j.translation_ko || ''),
    summary_ko: String(j.summary_ko || ''),
    record: {},
    risk_flags: [],
    term_mapping: [],
    clarifications: [],
    pii_residual: (Array.isArray(j.pii_residual) ? j.pii_residual : []).map(String).filter(x => x.trim()).slice(0, 10),
    confidence: ['high', 'medium', 'low'].includes(j.confidence) ? j.confidence : 'medium'
  };
  Object.keys(RECORD_FIELDS).forEach(k => { out.record[k] = String((j.record || {})[k] || ''); });
  (Array.isArray(j.risk_flags) ? j.risk_flags : []).forEach(f => {
    if (!f) return;
    out.risk_flags.push({
      level: LEVELS.includes(f.level) ? f.level : 'observe',
      category: RECORD_FIELDS[f.category] ? f.category : 'other',
      finding: String(f.finding || ''),
      evidence_source: String(f.evidence_source || ''),
      action: String(f.action || '')
    });
  });
  out.risk_flags.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  (Array.isArray(j.term_mapping) ? j.term_mapping : []).forEach(t => {
    if (t && t.source) out.term_mapping.push({ source: String(t.source), standard_ko: String(t.standard_ko || '') });
  });
  (Array.isArray(j.clarifications) ? j.clarifications : []).forEach(c => {
    if (c && (c.question_ko || c.question_source)) out.clarifications.push({ question_ko: String(c.question_ko || ''), question_source: String(c.question_source || '') });
  });
  return out;
}

// AI가 입력에 없던 가명 토큰([어르신A], [호실] 등)을 지어 넣는 경우가 있어, 입력에 실제로 있던 토큰만 남긴다.
const TOKEN_RE = /\[(?:어르신|보호자|직원)[A-Z]+\]|\[(?:전화번호|주민번호|이메일|주소|호실|생년월일)\]/g;
function stripInventedTokens(out, input) {
  const allowed = new Set(String(input).match(TOKEN_RE) || []);
  const clean = v => String(v).replace(TOKEN_RE, m => (allowed.has(m) ? m : '')).replace(/\(\s*\)/g, '').replace(/ {2,}/g, ' ').trim();
  out.summary_ko = clean(out.summary_ko);
  out.translation_ko = clean(out.translation_ko);
  Object.keys(out.record).forEach(k => { out.record[k] = clean(out.record[k]); });
  out.risk_flags.forEach(f => { f.finding = clean(f.finding); f.action = clean(f.action); });
}

/**
 * @param {object} body {task:'structure'|'feedback', text, lang, meta, targetLang}
 * @param {object} env process.env
 */
async function runTask(body, env) {
  body = body || {};
  const text = String(body.text || '').trim();
  if (!text) { const e = new Error('text 비어 있음'); e.status = 400; throw e; }
  if (text.length > MAX_INPUT) { const e = new Error(`입력은 ${MAX_INPUT}자 이내`); e.status = 413; throw e; }

  // 방어적 2차 비식별화: 클라이언트가 놓친 정형 PII(전화·주민번호 등)를 서버에서 한 번 더 제거
  const safe = deidentify(text).masked;

  const t0 = Date.now();
  if (body.task === 'feedback') {
    const { json, model } = await callGemini(FEEDBACK_SYSTEM, buildFeedbackPrompt(safe, body.targetLang || 'vi'), env);
    return {
      translation: String(json.translation || ''),
      back_translation_ko: String(json.back_translation_ko || ''),
      key_terms: Array.isArray(json.key_terms) ? json.key_terms.slice(0, 10) : [],
      _meta: { model, ms: Date.now() - t0 }
    };
  }
  const { json, model } = await callGemini(STRUCTURE_SYSTEM, buildStructurePrompt(safe, body.lang, body.meta), env);
  const out = normalizeStructure(json);
  stripInventedTokens(out, safe);
  out._meta = { model, ms: Date.now() - t0, server_masked: safe !== text };
  return out;
}

module.exports = { runTask, normalizeStructure, stripInventedTokens, RECORD_FIELDS, LANG_NAMES, STRUCTURE_SYSTEM, FEEDBACK_SYSTEM, MAX_INPUT };
