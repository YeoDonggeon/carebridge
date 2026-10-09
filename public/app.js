/* CareBridge 프런트엔드 — 요양보호사 기록 → 비식별 → AI 구조화 → 담당자 검토/승인 → 피드백 역번역 */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const FIELDS = {
    physical: '신체상태', meal: '식사·수분', excretion: '배설', sleep: '수면·휴식',
    cognition_emotion: '인지·정서·행동', medication: '투약·처치', activity_safety: '활동·안전', other: '기타·연락'
  };
  const LV = { urgent: '즉시 보고', caution: '당일 확인', observe: '관찰' };
  const LANGS = { vi: '베트남어', zh: '중국어', en: '영어', tl: '필리핀어', uz: '우즈베크어', ne: '네팔어', id: '인도네시아어', th: '태국어', mn: '몽골어', ru: '러시아어', ko: '한국어', km: '크메르어', my: '미얀마어' };
  const SPEECH = { vi: 'vi-VN', zh: 'zh-CN', en: 'en-US', tl: 'fil-PH', uz: 'uz-UZ', ne: 'ne-NP', id: 'id-ID', th: 'th-TH', mn: 'mn-MN', ru: 'ru-RU', ko: 'ko-KR' };

  // 요양보호사 화면 다국어 문구
  const I18N = {
    ko: { title: '관찰메모 작성', hint: '편한 언어로 자유롭게 쓰세요. 이름·전화번호 등은 보내기 전에 자동으로 가려집니다.', shift: '근무', caregiver: '작성자', placeholder: '오늘 어르신의 식사, 배설, 수면, 기분, 특이사항을 적어 주세요.', voice: '음성 입력', preview: '가림 미리보기', submit: '보내기', maskedTitle: 'AI로 보내지는 내용 (비식별)', sent: '전달 완료', questions: '담당자가 확인하고 싶은 내용', inbox: '담당자 메시지', sentMsg: '기록이 담당자에게 전달되었습니다.' },
    vi: { title: 'Ghi chép quan sát', hint: 'Hãy viết tự do bằng ngôn ngữ của bạn. Tên, số điện thoại… sẽ được tự động che trước khi gửi.', shift: 'Ca làm', caregiver: 'Người viết', placeholder: 'Hãy ghi lại việc ăn uống, đi vệ sinh, giấc ngủ, tâm trạng và điều đặc biệt của người cao tuổi hôm nay.', voice: 'Nói để nhập', preview: 'Xem bản đã che', submit: 'Gửi', maskedTitle: 'Nội dung gửi cho AI (đã ẩn danh)', sent: 'Đã gửi', questions: 'Quản lý muốn hỏi thêm', inbox: 'Tin nhắn từ quản lý', sentMsg: 'Đã gửi ghi chép cho quản lý.' },
    zh: { title: '写观察记录', hint: '请用您习惯的语言自由书写。姓名、电话等会在发送前自动隐藏。', shift: '班次', caregiver: '记录人', placeholder: '请写下老人今天的饮食、排便、睡眠、情绪和特别情况。', voice: '语音输入', preview: '预览隐藏效果', submit: '发送', maskedTitle: '发送给AI的内容（已去标识）', sent: '已发送', questions: '负责人想确认的问题', inbox: '负责人消息', sentMsg: '记录已发送给负责人。' },
    en: { title: 'Write an observation note', hint: 'Write freely in your own language. Names, phone numbers, etc. are hidden automatically before sending.', shift: 'Shift', caregiver: 'Written by', placeholder: "Write about today's meals, toileting, sleep, mood and anything unusual.", voice: 'Voice input', preview: 'Preview masking', submit: 'Send', maskedTitle: 'What is sent to the AI (de-identified)', sent: 'Sent', questions: 'Questions from your manager', inbox: 'Messages from manager', sentMsg: 'Your note was sent to the manager.' }
  };

  // ---------- 상태(이 기기 localStorage) ----------
  const KEY = 'carebridge_v1';
  let S = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.records) return s; } catch (_) {}
    return { nameMap: {}, roster: [], records: [], restore: false };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} renderBadge(); }

  let AI_LIVE = false;
  let selectedId = null;

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }

  // ---------- 탭 ----------
  $$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  function showTab(name) {
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.tab').forEach(s => (s.hidden = s.id !== 'tab-' + name));
    if (name === 'manager') renderQueue();
    if (name === 'caregiver') renderInbox();
    try { history.replaceState(null, '', '#' + name); } catch (_) {}
  }

  // ---------- AI 연결 확인 ----------
  async function checkAI() {
    const b = $('#modeBadge');
    try {
      const r = await fetch('api/ai', { method: 'GET' });
      const j = await r.json();
      AI_LIVE = !!j.configured;
    } catch (_) { AI_LIVE = false; }
    b.className = 'mode ' + (AI_LIVE ? 'live' : 'demo');
    b.textContent = AI_LIVE ? '● AI 연결됨 (Gemini)' : '● 데모 모드';
    b.title = AI_LIVE ? '생성형 AI가 실시간으로 처리합니다.' : 'AI 서버 키가 없어 예시 메모에 대해 사전 생성된 결과를 보여줍니다.';
  }

  async function callAI(body) {
    const r = await fetch('api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  // ---------- 요양보호사 화면 ----------
  const langSel = $('#cgLang'), memo = $('#cgMemo');
  function applyI18n() {
    const d = I18N[langSel.value] || I18N.en;
    $$('[data-i18n]', $('#tab-caregiver')).forEach(el => { if (d[el.dataset.i18n]) el.textContent = d[el.dataset.i18n]; });
    $$('[data-i18n-ph]').forEach(el => { if (d[el.dataset.i18nPh]) el.placeholder = d[el.dataset.i18nPh]; });
    renderInbox();
  }
  langSel.addEventListener('change', () => { try { localStorage.setItem('cb_lang', langSel.value); } catch (_) {} applyI18n(); });
  try { const l = localStorage.getItem('cb_lang'); if (l) langSel.value = l; } catch (_) {}
  try { const n = localStorage.getItem('cb_name'); if (n) $('#cgName').value = n; } catch (_) {}
  $('#cgName').addEventListener('change', e => { try { localStorage.setItem('cb_name', e.target.value); } catch (_) {} });
  memo.addEventListener('input', () => { $('#charCount').textContent = memo.value.length + ' / 4000'; });

  // 예시 메모
  const sampleList = $('#sampleList');
  (window.CB_DEMO || []).forEach(s => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = s.label;
    b.addEventListener('click', () => { langSel.value = s.lang; applyI18n(); memo.value = s.memo; memo.dispatchEvent(new Event('input')); preview(); $('.samples').open = false; });
    sampleList.appendChild(b);
  });

  function currentDeid() {
    return CBDeid.deidentify(memo.value, { roster: S.roster, nameMap: S.nameMap });
  }
  function highlightTokens(text) {
    return esc(text).replace(/\[(어르신|보호자|직원)[A-Z]+\]|\[(전화번호|주민번호|이메일|주소|호실|생년월일)\]/g, m => '<span class="tok">' + m + '</span>');
  }
  function preview() {
    if (!memo.value.trim()) { $('#maskedView').className = 'masked empty'; $('#maskedView').textContent = '메모가 비어 있습니다.'; $('#entityChips').innerHTML = ''; return null; }
    const d = currentDeid();
    $('#maskedView').className = 'masked';
    $('#maskedView').innerHTML = highlightTokens(d.masked);
    const counts = {};
    d.entities.forEach(e => (counts[e.type] = (counts[e.type] || 0) + 1));
    const TL = { NAME: '이름', PHONE: '전화번호', RRN: '주민번호', EMAIL: '이메일', ADDR: '주소', ROOM: '호실', DOB: '생년월일' };
    $('#entityChips').innerHTML = Object.keys(counts).length
      ? Object.keys(counts).map(k => `<span class="chip">🔒 ${TL[k] || k} ${counts[k]}건 가림</span>`).join('')
      : '<span class="small muted">가릴 개인정보가 발견되지 않았습니다. 이름을 호칭 없이 썼다면 담당자 화면의 ‘대상자 명부’에 등록하세요.</span>';
    return d;
  }
  $('#previewBtn').addEventListener('click', preview);

  $('#submitBtn').addEventListener('click', async () => {
    const d = preview();
    if (!d) return;
    const btn = $('#submitBtn'); btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>AI 정리 중…';
    const lang = langSel.value;
    const rec = {
      id: 'r' + Date.now().toString(36), createdAt: new Date().toISOString(), lang, shift: $('#cgShift').value,
      caregiver: $('#cgName').value || '(미기재)', masked: d.masked, entities: d.entities, status: 'pending', feedback: [], demo: false
    };
    try {
      let result;
      const demo = (window.CB_DEMO || []).find(s => s.memo.trim() === memo.value.trim());
      if (AI_LIVE) {
        result = await callAI({ task: 'structure', text: d.masked, lang, meta: { shift: rec.shift, date: rec.createdAt.slice(0, 10) } });
      } else if (demo) {
        await new Promise(r => setTimeout(r, 900));
        result = fillDemo(demo.result, d);
        rec.demo = true;
      } else {
        throw new Error('데모 모드에서는 ‘예시 메모’만 처리할 수 있습니다. 실제 AI 처리는 서버에 GEMINI_API_KEY를 설정하세요.');
      }
      rec.result = result;
      rec.draft = Object.assign({}, result.record);
      rec.leaks = CBDeid.leakCheck(result, d.entities);
      S.nameMap = d.nameMap;
      S.records.unshift(rec);
      save();
      showCgResult(rec);
      toast((I18N[lang] || I18N.en).sentMsg);
    } catch (e) {
      toast('⚠️ ' + e.message);
    } finally { btn.disabled = false; btn.innerHTML = old; }
  });

  function fillDemo(res, d) {
    const name = (d.entities.find(e => e.type === 'NAME') || {}).token || '[어르신A]';
    const s = JSON.stringify(res).split('{{N}}').join(name).split('{{R}}').join('[호실]');
    const j = JSON.parse(s);
    j._meta = { model: 'demo(사전 생성 결과)', ms: 900 };
    return j;
  }

  function showCgResult(rec) {
    const d = I18N[rec.lang] || I18N.en;
    $('#cgResult').hidden = false;
    const qs = (rec.result.clarifications || []);
    $('#cgQuestions').innerHTML = qs.length
      ? `<p class="small muted">${esc(d.questions)}</p>` + qs.map(q => `<div class="q">${esc(q.question_source || q.question_ko)}</div>`).join('')
      : '';
  }

  function renderInbox() {
    const d = I18N[langSel.value] || I18N.en;
    const msgs = [];
    S.records.forEach(r => (r.feedback || []).forEach(f => { if (f.lang === langSel.value) msgs.push({ f, r }); }));
    $('#cgInbox').innerHTML = msgs.length
      ? `<div class="inbox"><h3>📩 ${esc(d.inbox)}</h3>` + msgs.slice(0, 5).map(({ f }) => `<div class="msg">${esc(f.translation)}<small>${new Date(f.at).toLocaleString()}</small></div>`).join('') + '</div>'
      : '';
  }

  // 음성 입력 (Web Speech API)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  $('#micBtn').addEventListener('click', () => {
    if (!SR) return toast('이 브라우저는 음성 입력을 지원하지 않습니다 (Chrome 권장).');
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = SPEECH[langSel.value] || 'en-US'; rec.interimResults = false; rec.continuous = true;
    rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) memo.value += (memo.value ? ' ' : '') + e.results[i][0].transcript; memo.dispatchEvent(new Event('input')); };
    rec.onend = () => { rec = null; $('#micBtn').classList.remove('rec'); };
    rec.onerror = (e) => toast('음성 인식 오류: ' + e.error);
    rec.start(); $('#micBtn').classList.add('rec');
  });

  // ---------- 담당자 화면 ----------
  function topLevel(r) {
    const f = (r.result && r.result.risk_flags) || [];
    return f.length ? f[0].level : 'none';
  }
  function renderBadge() {
    const n = S.records.filter(r => r.status === 'pending').length;
    const b = $('#pendingBadge'); b.hidden = !n; b.textContent = n;
  }
  $('#filter').addEventListener('change', renderQueue);
  function renderQueue() {
    const f = $('#filter').value;
    const order = { urgent: 0, caution: 1, observe: 2, none: 3 };
    const list = S.records.filter(r => f === 'all' || r.status === f)
      .slice().sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1) || order[topLevel(a)] - order[topLevel(b)] || b.createdAt.localeCompare(a.createdAt));
    const cnt = { urgent: 0, caution: 0, pending: 0 };
    S.records.forEach(r => { if (r.status === 'pending') cnt.pending++; (r.result.risk_flags || []).forEach(x => { if (cnt[x.level] != null && r.status === 'pending') cnt[x.level]++; }); });
    $('#stats').innerHTML = `<div class="stat"><b>${cnt.pending}</b>검토 대기</div><div class="stat"><b style="color:var(--urgent)">${cnt.urgent}</b>즉시 보고</div><div class="stat"><b style="color:var(--caution)">${cnt.caution}</b>당일 확인</div>`;
    $('#queue').innerHTML = list.length ? list.map(r => {
      const lv = topLevel(r);
      return `<li data-id="${r.id}" class="${r.id === selectedId ? 'sel' : ''}">
        <div class="row between"><span class="lv ${lv}">${lv === 'none' ? '특이 없음' : LV[lv]}</span><span class="st ${r.status}">${r.status === 'approved' ? '승인됨' : '검토 대기'}</span></div>
        <div class="sum">${esc(show(r.result.summary_ko || '(요약 없음)'))}</div>
        <div class="meta">${esc(LANGS[r.lang] || r.lang)} · ${esc(r.shift)} · ${esc(r.caregiver)} · ${new Date(r.createdAt).toLocaleString()}${r.demo ? ' · 데모' : ''}</div>
      </li>`;
    }).join('') : '<li class="muted small" style="cursor:default">기록이 없습니다.</li>';
    $$('#queue li[data-id]').forEach(li => li.addEventListener('click', () => { selectedId = li.dataset.id; renderQueue(); renderDetail(); }));
    renderRoster();
  }

  // 담당자 기기에서만 가명→실명 복원 표시
  function show(text) { return S.restore ? CBDeid.reidentify(text, S.nameMap) : text; }

  function renderDetail() {
    const r = S.records.find(x => x.id === selectedId);
    const box = $('#detail');
    if (!r) { box.innerHTML = '<div class="empty-state"><p>왼쪽 대기열에서 기록을 선택하세요.</p></div>'; return; }
    const R = r.result;
    const flags = (R.risk_flags || []).map(f => `<div class="flag ${f.level}"><span class="lv ${f.level}">${LV[f.level]}</span> <b>${esc(show(f.finding))}</b> <span class="small muted">· ${esc(FIELDS[f.category] || '')}</span>
        <div class="ev">근거(원문): “${esc(show(f.evidence_source))}”</div><div class="act">➜ ${esc(show(f.action))}</div></div>`).join('') || '<p class="small muted">표시된 위험 신호가 없습니다.</p>';
    const rows = Object.keys(FIELDS).map(k => `<tr class="${r.draft[k] ? '' : 'blank'}"><th>${FIELDS[k]}</th><td><textarea data-k="${k}" rows="${Math.max(1, Math.ceil((r.draft[k] || '').length / 48))}" ${r.status === 'approved' ? 'readonly' : ''} placeholder="(원문에 언급 없음)">${esc(show(r.draft[k] || ''))}</textarea></td></tr>`).join('');
    const terms = (R.term_mapping || []).map(t => `<span class="term">${esc(t.source)} → <b>${esc(t.standard_ko)}</b></span>`).join('');
    const qs = (R.clarifications || []).map(q => `<div class="q">${esc(show(q.question_ko))}<div class="small muted">${esc(q.question_source)}</div></div>`).join('');
    const fb = (r.feedback || []).map(f => `<div class="q"><b>보냄:</b> ${esc(f.ko)}<div class="small">${esc(f.translation)}</div><div class="small muted">역번역 확인: ${esc(f.back)}</div></div>`).join('');
    box.innerHTML = `
      <div class="dhead">
        <div><h2>${esc(show(R.summary_ko || '관찰 기록'))}</h2>
          <div class="meta">${esc(LANGS[r.lang] || r.lang)} 원문 · ${esc(r.shift)} 근무 · 작성 ${esc(r.caregiver)} · ${new Date(r.createdAt).toLocaleString()} · 신뢰도 ${esc({ high: '높음', medium: '보통', low: '낮음' }[R.confidence] || R.confidence)}</div>
          <div class="meta">처리: ${esc((R._meta || {}).model || '')} ${(R._meta || {}).ms ? '· ' + ((R._meta.ms) / 1000).toFixed(1) + '초' : ''}</div>
        </div>
        <label class="inline small"><input type="checkbox" id="restoreChk" style="width:auto" ${S.restore ? 'checked' : ''}> 이 기기에서 실명 보기</label>
      </div>
      ${r.demo ? '<div class="demo-note">데모 모드: 이 결과는 예시 메모에 대해 사전 생성된 결과입니다. 실제 AI 처리는 API 키 연결 시 동작합니다.</div>' : ''}
      ${R.pii_residual && R.pii_residual.length ? `<div class="warn">🔎 AI가 가려지지 않은 개인정보 의심 항목을 발견했습니다: <b>${esc(R.pii_residual.join(', '))}</b> — 대상자 명부에 등록하면 다음부터 자동으로 가려집니다.</div>` : ''}
      ${r.leaks && r.leaks.length ? `<div class="warn">⚠️ AI 응답에서 원본 개인정보로 보이는 문자열이 발견되었습니다: ${esc(r.leaks.join(', '))}</div>` : ''}
      <h3>⚠️ 위험 신호</h3><div class="flags">${flags}</div>
      <h3>📝 구조화 기록 초안 <span class="small muted">(수정 후 승인)</span></h3>
      <table class="rec">${rows}</table>
      <div class="cols">
        <div><h3>🌐 원문 (비식별)</h3><div class="box">${highlightTokens(show(r.masked))}</div></div>
        <div><h3>🇰🇷 한국어 번역</h3><div class="box">${esc(show(R.translation_ko))}</div></div>
      </div>
      ${terms ? `<h3>📖 용어 표준화</h3><div class="terms">${terms}</div>` : ''}
      ${qs ? `<h3>❓ 요양보호사에게 확인할 점</h3>${qs}` : ''}
      <h3>💬 요양보호사에게 피드백 <span class="small muted">(${esc(LANGS[r.lang] || r.lang)}로 번역되어 전달)</span></h3>
      ${fb}
      <div class="row gap"><input id="fbText" placeholder="예: 화장실 가실 때는 꼭 함께 가 주세요. 어지러우시면 바로 알려 주세요."><button id="fbSend" class="secondary" type="button">번역해서 보내기</button></div>
      <div class="actions">
        <button id="copyBtn" class="ghost" type="button">📋 기록지 텍스트 복사</button>
        ${r.status === 'approved' ? '<button id="reopenBtn" class="ghost" type="button">승인 취소</button>' : '<button id="approveBtn" class="primary" type="button">✔ 검토 완료·승인</button>'}
      </div>`;

    $$('textarea[data-k]', box).forEach(t => t.addEventListener('input', () => { r.draft[t.dataset.k] = S.restore ? pseudo(t.value) : t.value; save(); }));
    $('#restoreChk').addEventListener('change', e => { S.restore = e.target.checked; save(); renderQueue(); renderDetail(); });
    $('#copyBtn').addEventListener('click', () => {
      const txt = `[돌봄 관찰기록] ${new Date(r.createdAt).toLocaleDateString()} ${r.shift} / 작성: ${r.caregiver} (${LANGS[r.lang] || r.lang} 원문, AI 초안 검토)\n` +
        Object.keys(FIELDS).filter(k => r.draft[k]).map(k => `- ${FIELDS[k]}: ${show(r.draft[k])}`).join('\n') +
        ((R.risk_flags || []).length ? '\n[위험 신호]\n' + R.risk_flags.map(f => `- (${LV[f.level]}) ${show(f.finding)} → ${show(f.action)}`).join('\n') : '');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('복사되었습니다.'), () => { prompt('복사할 내용', txt); });
    });
    const ab = $('#approveBtn'); if (ab) ab.addEventListener('click', () => { r.status = 'approved'; r.approvedAt = new Date().toISOString(); save(); renderQueue(); renderDetail(); toast('승인되었습니다.'); });
    const rb = $('#reopenBtn'); if (rb) rb.addEventListener('click', () => { r.status = 'pending'; save(); renderQueue(); renderDetail(); });
    $('#fbSend').addEventListener('click', async () => {
      const ko = $('#fbText').value.trim(); if (!ko) return;
      const btn = $('#fbSend'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>번역 중';
      try {
        const koMasked = CBDeid.deidentify(ko, { roster: S.roster, nameMap: S.nameMap }).masked;
        let out;
        if (r.lang === 'ko') out = { translation: ko, back_translation_ko: '(한국어 — 번역 불필요)' };
        else if (AI_LIVE) out = await callAI({ task: 'feedback', text: koMasked, targetLang: r.lang });
        else {
          const d = (window.CB_DEMO_FEEDBACK || {})[r.lang];
          if (!d) throw new Error('데모 모드에서는 예시 언어만 번역할 수 있습니다.');
          await new Promise(res => setTimeout(res, 700));
          out = d; toast('데모 모드: 사전 생성된 예시 번역을 보여줍니다.');
        }
        r.feedback.push({ ko, translation: out.translation, back: out.back_translation_ko, lang: r.lang, at: new Date().toISOString() });
        save(); renderDetail();
      } catch (e) { toast('⚠️ ' + e.message); btn.disabled = false; btn.textContent = '번역해서 보내기'; }
    });
  }
  function pseudo(text) { // 실명 보기 상태에서 수정한 텍스트를 다시 가명으로 저장
    let out = text; Object.keys(S.nameMap).sort((a, b) => b.length - a.length).forEach(k => { if (k.length >= 2) out = out.split(k).join(S.nameMap[k]); }); return out;
  }

  // 명부
  function renderRoster() {
    $('#rosterList').innerHTML = S.roster.map((p, i) => `<li>${esc(p.name)} ${p.aliases.length ? '(' + esc(p.aliases.join(', ')) + ')' : ''} → <span class="tok">${esc(S.nameMap[p.name] || '(첫 기록 시 부여)')}</span> <button class="link danger" data-i="${i}" type="button">삭제</button></li>`).join('');
    $$('#rosterList button').forEach(b => b.addEventListener('click', () => { S.roster.splice(+b.dataset.i, 1); save(); renderRoster(); }));
  }
  $('#rAdd').addEventListener('click', () => {
    const name = $('#rName').value.trim(); if (!name) return;
    const aliases = $('#rAlias').value.split(',').map(s => s.trim()).filter(Boolean);
    S.roster.push({ name, aliases, role: 'resident' });
    // 즉시 토큰 부여
    S.nameMap = CBDeid.deidentify(name, { roster: S.roster, nameMap: S.nameMap }).nameMap;
    $('#rName').value = ''; $('#rAlias').value = ''; save(); renderRoster();
  });
  $('#resetAll').addEventListener('click', () => {
    if (!confirm('이 기기의 모든 기록과 가명 매핑을 삭제할까요?')) return;
    S = { nameMap: {}, roster: [], records: [], restore: false }; selectedId = null; save(); renderQueue(); renderDetail(); renderInbox();
  });

  // ---------- 시작 ----------
  applyI18n(); renderBadge(); checkAI();
  const h = (location.hash || '').slice(1);
  if (['caregiver', 'manager', 'about'].includes(h)) showTab(h);
})();
