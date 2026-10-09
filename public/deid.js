/*
 * CareBridge 비식별화 모듈 (브라우저 · Node 공용)
 * 원문 관찰메모가 기기를 떠나기 전에 개인식별정보(PII)를 가명 토큰으로 치환한다.
 *  - 규칙 기반(정규식) + 명부(roster) 기반 이름 치환
 *  - 같은 이름은 항상 같은 토큰([어르신A] 등)으로 치환 → 기록 간 일관성 유지
 *  - 치환 매핑은 기기 로컬에만 보관(서버/AI로 전송하지 않음)
 */
(function (root) {
  'use strict';

  // 한국 성씨(로마자) — 외국인 요양보호사가 어르신 이름을 로마자로 적는 경우 대응
  const ROMAN_SURNAMES_STRONG = [
    'Kim', 'Lee', 'Yi', 'Park', 'Pak', 'Choi', 'Choe', 'Jung', 'Jeong', 'Chung', 'Kang', 'Cho', 'Jo',
    'Yoon', 'Yun', 'Jang', 'Chang', 'Lim', 'Im', 'Han', 'Seo', 'Suh', 'Shin', 'Sin', 'Kwon', 'Hwang',
    'Ahn', 'An', 'Yoo', 'Yu', 'Ryu', 'Hong', 'Jeon', 'Jun', 'Chun', 'Yang', 'Bae', 'Baek', 'Paik',
    'Heo', 'Hur', 'Nam', 'Shim', 'Sim', 'Noh', 'Roh', 'Kwak', 'Sung', 'Seong', 'Cha', 'Koo', 'Gu', 'Jin'
  ];
  // 일반 단어와 겹칠 수 있어 존칭이 붙을 때만 이름으로 판단하는 성씨
  const ROMAN_SURNAMES_WEAK = ['Oh', 'Ha', 'Na', 'Son', 'Song', 'Moon', 'Min', 'Woo', 'Joo', 'Ko', 'Go', 'Do', 'Ma', 'Won', 'Nah'];

  // 한자 성씨(중국어권 요양보호사)
  const HANZI_SURNAMES = '金李朴崔郑鄭姜赵趙尹张張林韩韓吴吳徐申权權黄黃安宋柳洪全高文孙孫梁白许許南沈卢盧丁河郭成车車朱禹具罗羅闵閔陈陳刘劉王';

  const KO_TITLES = '어르신|할머니|할머님|할아버지|할아버님|님|씨|환자분|환자|보호자|여사님|선생님|어머니|아버님|아버지|어머님';
  // 이름처럼 보이지만 이름이 아닌 한국어 단어(오탐 방지)
  const KO_STOP = new Set([
    '우리', '이분', '그분', '저분', '옆방', '오늘', '어제', '담당', '보호', '요양', '간호', '간호사', '사회복지',
    '다른', '모든', '같은', '해당', '대상', '입소', '방문', '센터', '시설', '가족', '아드님', '따님', '며느리',
    '친할', '외할', '할', '선생', '원장', '팀장', '국장', '실장', '주간', '야간', '어린', '늙은', '아픈',
    '그', '이', '저', '각', '한', '두', '세', '새로', '처음', '어르', '할아', '요양보호사', '보호사', '환자',
    '아드', '보호자', '가족분', '아버', '어머', '할머', '며느', '직원', '오늘', '정말', '안쪽', '한번', '조금',
    '전에', '주간', '야간', '심한', '고령', '노인', '남자', '여자', '남성', '여성', '신규', '신입', '장기',
    '하루', '매일', '계속', '전부', '모두', '서로', '성실', '조용', '문제', '방금', '금방', '진짜', '임시',
    '노모', '양쪽', '한쪽', '백발', '강한', '손님', '주무', '차분', '구석', '윤기', '황당', '배고', '안녕'
  ]);

  const RULES = [
    // 주민등록번호
    { type: 'RRN', label: '[주민번호]', re: /\b\d{6}\s?-\s?[1-4]\d{6}\b/g },
    // 이메일
    { type: 'EMAIL', label: '[이메일]', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
    // 국제번호 포함 전화번호 (+82 10 1234 5678, +84-90-123-4567 …)
    { type: 'PHONE', label: '[전화번호]', re: /\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,3}/g },
    // 국내 전화번호 (010-1234-5678, 01012345678, 042-123-4567 …)
    { type: 'PHONE', label: '[전화번호]', re: /\b0\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g },
    // 생년월일(키워드 동반 시)
    { type: 'DOB', label: '[생년월일]', re: /(생년월일|생일|DOB|date of birth|born|sinh ngày|ngày sinh|出生日期|生日)\s*[:：]?\s*\d{2,4}[.\-/년年]\s?\d{1,2}[.\-/월月]\s?\d{1,2}[일日]?/gi },
    // 도로명/지번 주소
    { type: 'ADDR', label: '[주소]', re: /(?:[가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도|시)\s)?[가-힣]+(?:시|구|군)\s[가-힣0-9]+(?:로|길|동|읍|면|리)(?:\s?[0-9가-힣]+(?:로|길))?\s?\d+(?:-\d+)?(?:번지)?/g },
    // 호실 (302호, 302호실, room 108, phòng 302, 205号房, 205号, 205호 병실)
    { type: 'ROOM', label: '[호실]', re: /\b\d{2,4}\s?호실?|\b[Rr]oom\s?(?:no\.?\s?)?\d{1,4}\b|\b[Pp]hòng\s?(?:số\s?)?\d{1,4}\b|\b(?:[Kk]amar|[Xx]ona|[Kk]warto|[Hh]abitación|[Кк]омната|[Пп]алата|[Өө]рөө)\s?(?:no\.?\s?)?\d{1,4}\b|ห้อง\s?\d{1,4}|कोठा\s?(?:नं\.?\s?)?\d{1,4}|\d{1,4}\s?号(?:房|病房|室)?/g },
  ];

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function tokenLetter(n) {
    // 0→A, 25→Z, 26→AA …
    let s = '';
    n = n + 1;
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  /**
   * @param {string} text 원문 관찰메모
   * @param {object} opts
   *   roster: [{name:'김영자', aliases:['Kim Young-ja','金英子'], role:'resident'|'family'|'staff'}]
   *   nameMap: 기존 이름→토큰 매핑(일관성 유지용, {원문이름: '[어르신A]'})
   * @returns {{masked:string, entities:Array, nameMap:object}}
   */
  function deidentify(text, opts) {
    opts = opts || {};
    const roster = opts.roster || [];
    const nameMap = Object.assign({}, opts.nameMap || {});
    const entities = [];
    let out = String(text || '');

    function personToken(rawName, role) {
      const key = normalizeName(rawName);
      if (nameMap[key]) return nameMap[key];
      const prefix = role === 'family' ? '보호자' : role === 'staff' ? '직원' : '어르신';
      const used = Object.values(nameMap).filter(t => t.startsWith('[' + prefix)).length;
      const tok = '[' + prefix + tokenLetter(used) + ']';
      nameMap[key] = tok;
      return tok;
    }

    function replace(re, fn, type) {
      out = out.replace(re, function () {
        const m = arguments[0];
        const r = fn.apply(null, arguments);
        if (r !== m) entities.push({ type: type, original: m, token: r });
        return r;
      });
    }

    // 1) 명부 기반 이름 치환 (가장 정확) — 긴 이름부터
    const rosterNames = [];
    roster.forEach(p => {
      [p.name].concat(p.aliases || []).filter(Boolean).forEach(n => rosterNames.push({ n: n, p: p }));
    });
    rosterNames.sort((a, b) => b.n.length - a.n.length);
    rosterNames.forEach(({ n, p }) => {
      const tok = personToken(p.name, p.role);
      if (n !== p.name) nameMap[normalizeName(n)] = tok;
      replace(new RegExp(escapeRe(n), 'g'), () => tok, 'NAME');
    });

    // 2) 정형 패턴(전화·주민번호·주소·호실 등)
    RULES.forEach(rule => replace(rule.re, (m) => {
      // 호실 규칙이 전화번호 일부를 잡지 않도록 토큰 내부는 건너뜀
      return rule.label;
    }, rule.type));

    // 3) 한국어 "이름 + 존칭" (김영자 할머니, 최순자님, 박 어르신)
    replace(new RegExp('([가-힣]{1,4})(\\s?)(' + KO_TITLES + ')(?![가-힣])', 'g'), (m, name, sp, title) => {
      if (KO_STOP.has(name) || name.length < 1) return m;
      // 1글자는 성씨일 때만 (박 어르신). '이/그/저/한' 등 지시어·관형사와 겹치는 글자는 제외
      if (name.length === 1) {
        if (!/[김박최정강조윤장임오서신권황안송류홍고문손양배백허남심노하곽성차주우구민진유]/.test(name)) return m;
      } else {
        // 2~4글자는 한국 성씨로 시작하는 이름 꼴일 때만
        if (!isLikelyKoreanName(name)) return m;
        // 조사/어미로 끝나거나 직함·집단명사로 끝나면 제외 (…하는 할머니, 센터장님)
        if (/[는은을를가에의도고서며면]$/.test(name) || /(장|사|관|들|님)$/.test(name)) return m;
      }
      return personToken(name, /보호자/.test(title) ? 'family' : 'resident') + sp + title;
    }, 'NAME');

    // 4) 존칭 + 로마자 이름 (Mr. Lee, Mrs Park, bà Kim Young-ja, ông Park, Grandma Choi)
    const ALL_SUR = ROMAN_SURNAMES_STRONG.concat(ROMAN_SURNAMES_WEAK).join('|');
    const GIVEN = "(?:[\\s-][A-Z][a-z]+(?:-[a-z]+)?){0,2}";
    const HONORIFIC = "(?:Mr\\.?|Mrs\\.?|Ms\\.?|Miss|Mdm\\.?|Madam|Grandma|Grandpa|Granny|Lola|Lolo|Nanay|Tatay|Lolang|bà|ông|cụ|bác|cô|chú|Bà|Ông|Cụ|Bác|Ibu|Bapak|Pak|Nenek|Kakek)";
    replace(new RegExp('(?<![\\p{L}])' + HONORIFIC + '\\s+(?:' + ALL_SUR + ')' + GIVEN + '(?![\\p{L}])', 'gu'), (m) => {
      const h = m.match(new RegExp('^' + HONORIFIC))[0];
      const name = m.slice(h.length).trim();
      return h + ' ' + personToken(name, 'resident');
    }, 'NAME');

    // 4-b) 로마자 성씨 + 후치 호칭 (우즈베크어 Kim buvi/ota, 몽골어 Kim emee, 한국어 로마자 halmoni/ssi)
    replace(new RegExp('\\b(' + ALL_SUR + ')(?:[\\s-](?:buvi|bobo|ota|opa|aya|xola|emee|övöö|halmoni|harabeoji|halmeoni|ssi|nim|eomeoni|apa|baba|amma|bajé|hajur ?ama|hajur ?buwa))\\b', 'giu'), (m, sur) => {
      return m.replace(sur, personToken(sur, 'resident'));
    }, 'NAME');

    // 5) 로마자 "성 + 이름" 단독 (Kim Young-ja, Park Soon-ja) — 강한 성씨만
    replace(new RegExp('\\b(?:' + ROMAN_SURNAMES_STRONG.join('|') + ')(?:[\\s-][A-Z][a-z]+(?:-[a-z]+)?){1,2}\\b', 'g'), (m) => {
      return personToken(m, 'resident');
    }, 'NAME');

    // 6) 한자 성씨 + 호칭 (朴奶奶, 金爷爷, 李阿姨, 崔先生)
    replace(new RegExp('([' + HANZI_SURNAMES + '][\\u4e00-\\u9fff]{0,2}?)(奶奶|爷爷|爺爺|阿姨|老人家|老人|先生|女士|大爷|大娘|婆婆|爷|伯伯)', 'g'), (m, name, title) => {
      return personToken(name, 'resident') + title;
    }, 'NAME');

    // 7) 이미 매핑된 이름이 호칭 없이 다시 나오면 치환 (예: 앞에서 '김영자 할머니' → 뒤에 '김영자')
    Object.keys(nameMap).sort((a, b) => b.length - a.length).forEach(key => {
      if (key.length < 2 || ROMAN_SURNAMES_WEAK.indexOf(key) !== -1) return;
      const re = new RegExp(escapeRe(key) + '(?![가-힣A-Za-z])', 'g');
      replace(re, () => nameMap[key], 'NAME');
    });

    return { masked: out, entities: entities, nameMap: nameMap };
  }

  function isLikelyKoreanName(s) {
    return /^[김이박최정강조윤장임한오서신권황안송류홍전고문손양배백허남심노하곽성차주우구나민진유][가-힣]{1,2}$/.test(s);
  }

  function normalizeName(s) { return String(s).trim().replace(/\s+/g, ' '); }

  /** AI 응답에 원본 개인정보가 섞여 있는지 검사 (유출 방지 2차 확인) */
  function leakCheck(obj, entities) {
    const txt = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const leaks = [];
    (entities || []).forEach(e => {
      const o = String(e.original).trim();
      if (o.length >= 2 && txt.indexOf(o) !== -1) leaks.push(o);
    });
    return Array.from(new Set(leaks));
  }

  /** 토큰을 원래 이름으로 되돌림 (담당자 기기에서만) */
  function reidentify(text, nameMap) {
    let out = String(text || '');
    const inv = {};
    Object.keys(nameMap || {}).forEach(k => { if (!inv[nameMap[k]]) inv[nameMap[k]] = k; });
    Object.keys(inv).forEach(tok => { out = out.split(tok).join(inv[tok]); });
    return out;
  }

  const api = { deidentify, leakCheck, reidentify, _RULES: RULES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CBDeid = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
