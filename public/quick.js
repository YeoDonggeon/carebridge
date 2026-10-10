/*
 * CareBridge 빠른 선택 — 요양보호사가 8개 기록 항목을 탭으로 고르는 객관식 입력
 * 고른 문구는 요양보호사의 언어로 메모에 한 줄씩 들어간다("식사: 절반 드심").
 * 메모 글 자체가 바뀌는 것이라 뒤의 비식별 → AI 구조화 흐름은 자유 서술과 똑같다.
 * 문구 순서: [ko, vi, zh, en]. 그 밖의 언어는 영어로 표시·입력한다.
 */
(function (root) {
  'use strict';
  const LANG_IDX = { ko: 0, vi: 1, zh: 2, en: 3 };
  const UI = {
    title: ['빠른 선택 (눌러서 기록)', 'Chọn nhanh (bấm để ghi)', '快速选择（点击记录）', 'Quick select (tap to record)'],
    other: ['기타', 'Khác', '其他', 'Other']
  };
  const CATS = [
    { key: 'physical', icon: '🩺', label: ['신체상태', 'Cơ thể', '身体', 'Body'], opts: [
      ['특이 없음', 'Bình thường', '正常', 'Normal'],
      ['열이 있음', 'Bị sốt', '发烧', 'Fever'],
      ['아프다고 함', 'Kêu đau', '说疼', 'Complains of pain'],
      ['피부가 붉거나 부음', 'Da đỏ hoặc sưng', '皮肤发红或肿', 'Skin red or swollen']] },
    { key: 'meal', icon: '🍚', label: ['식사', 'Ăn uống', '饮食', 'Meals'], opts: [
      ['다 드심', 'Ăn hết', '全部吃完', 'Ate everything'],
      ['절반 드심', 'Ăn một nửa', '吃了一半', 'Ate half'],
      ['거의 못 드심', 'Ăn rất ít', '吃得很少', 'Ate very little'],
      ['안 드시려 함', 'Không chịu ăn', '拒绝进食', 'Refused to eat'],
      ['사레 들림', 'Bị sặc khi ăn', '吃饭时呛到', 'Choked while eating']] },
    { key: 'excretion', icon: '🚽', label: ['배설', 'Đi vệ sinh', '排泄', 'Toileting'], opts: [
      ['정상', 'Bình thường', '正常', 'Normal'],
      ['대변 못 봄', 'Chưa đi đại tiện', '没有大便', 'No bowel movement'],
      ['설사', 'Tiêu chảy', '腹泻', 'Diarrhea'],
      ['소변 색이 진함', 'Nước tiểu sẫm màu', '尿色深', 'Dark urine']] },
    { key: 'sleep', icon: '😴', label: ['수면', 'Giấc ngủ', '睡眠', 'Sleep'], opts: [
      ['잘 주무심', 'Ngủ ngon', '睡得好', 'Slept well'],
      ['자주 깸', 'Thức dậy nhiều lần', '多次醒来', 'Woke up many times'],
      ['거의 못 주무심', 'Hầu như không ngủ', '几乎没睡', 'Hardly slept']] },
    { key: 'cognition_emotion', icon: '🙂', label: ['기분·행동', 'Tâm trạng', '情绪', 'Mood'], opts: [
      ['편안함', 'Vui vẻ, bình tĩnh', '平静', 'Calm'],
      ['불안해함', 'Lo lắng, bồn chồn', '焦虑不安', 'Anxious'],
      ['헷갈려함', 'Lú lẫn', '糊涂', 'Confused'],
      ['돌아다님', 'Đi lang thang', '到处走动', 'Wandering']] },
    { key: 'medication', icon: '💊', label: ['약', 'Thuốc', '服药', 'Medicine'], opts: [
      ['약 드심', 'Đã uống thuốc', '已服药', 'Took medicine'],
      ['약 거부', 'Không chịu uống thuốc', '拒绝服药', 'Refused medicine'],
      ['약 빠뜨림', 'Quên uống thuốc', '漏服药', 'Missed medicine']] },
    { key: 'activity_safety', icon: '🚶', label: ['활동·안전', 'An toàn', '安全', 'Safety'], opts: [
      ['특이 없음', 'Bình thường', '正常', 'Normal'],
      ['어지러워함', 'Chóng mặt', '头晕', 'Dizzy'],
      ['넘어질 뻔함', 'Suýt ngã', '差点摔倒', 'Almost fell'],
      ['넘어짐', 'Bị ngã', '摔倒了', 'Fell down']] },
    { key: 'other', icon: '📞', label: ['연락·기타', 'Liên lạc', '联系', 'Contact'], opts: [
      ['가족 연락 있음', 'Gia đình gọi điện', '家属来电', 'Family called'],
      ['병원 다녀옴', 'Đã đi bệnh viện', '去了医院', 'Went to hospital']] }
  ];

  const idx = lang => (LANG_IDX[lang] != null ? LANG_IDX[lang] : LANG_IDX.en);
  const line = (cat, opt, lang) => `${cat.label[idx(lang)]}: ${opt[idx(lang)]}`;

  /** 메모에서 줄을 켜고 끈다. 같은 항목의 다른 선택지는 지운다(항목당 하나). */
  function toggle(memo, cat, opt, lang) {
    const target = line(cat, opt, lang);
    const mine = cat.opts.map(o => line(cat, o, lang));
    const lines = String(memo || '').split('\n');
    const had = lines.includes(target);
    const kept = lines.filter(l => !mine.includes(l));
    if (!had) kept.push(target);
    return kept.filter((l, i) => l.trim() || i < kept.length - 1).join('\n').replace(/^\n+/, '');
  }
  const isOn = (memo, cat, opt, lang) => String(memo || '').split('\n').includes(line(cat, opt, lang));

  const api = { CATS, UI, idx, line, toggle, isOn };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CBQuick = api;
})(typeof self !== 'undefined' ? self : this);
