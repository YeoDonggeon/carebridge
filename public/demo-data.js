/*
 * 데모 모드 데이터 — AI 서버(API 키)가 연결되지 않았을 때 시연용으로 쓰는 예시 메모와
 * 사전 생성된 결과. 화면에 "데모(사전 생성 결과)"로 명확히 표시된다.
 * 모든 인물·수치는 가상이다.
 */
window.CB_DEMO = [
  {
    id: 'vi-fall',
    lang: 'vi',
    label: '🇻🇳 베트남어 · 식사저하/낙상직전',
    memo: 'Hôm nay bà Kim Young-ja (phòng 302) ăn sáng chỉ được khoảng 1/3 bát cháo, nói là không muốn ăn. Uống nước ít, khoảng 2 cốc cả ngày. Buổi chiều khi đi vệ sinh bà bị chóng mặt, suýt ngã, tôi đỡ kịp nên không bị thương. Đầu gối trái hơi đỏ và sưng nhẹ. Tối bà ngủ sớm nhưng thức dậy 2 lần gọi con gái. Đã uống thuốc huyết áp buổi sáng. Số điện thoại con gái: 010-2345-6789.',
    result: {
      source_language: 'vi',
      translation_ko: '오늘 {{N}} 할머니({{R}})는 아침에 죽을 약 1/3그릇만 드셨고, 먹고 싶지 않다고 하셨습니다. 물은 하루 종일 약 2컵 정도로 적게 드셨습니다. 오후에 화장실에 가실 때 어지러워하시며 넘어질 뻔하셨는데, 제가 제때 부축해서 다치지는 않으셨습니다. 왼쪽 무릎이 약간 붉고 살짝 부어 있습니다. 저녁에는 일찍 주무셨지만 두 번 깨어 딸을 부르셨습니다. 아침에 혈압약을 드셨습니다. 딸 전화번호: [전화번호].',
      summary_ko: '식사·수분 저하 + 화장실 이동 중 어지럼·낙상 직전',
      record: {
        physical: '왼쪽 무릎 경미한 발적 및 부종 관찰됨. 오후 화장실 이동 중 어지럼 호소.',
        meal: '아침 죽 약 1/3그릇 섭취(식욕 저하 호소). 하루 수분 섭취 약 2컵으로 적음.',
        excretion: '오후 화장실 이용(배설 양상 기록 없음).',
        sleep: '저녁 조기 취침, 야간 2회 각성하여 딸을 찾으심.',
        cognition_emotion: '야간 각성 시 가족(딸)을 찾는 모습 관찰됨.',
        medication: '아침 혈압약 복용함.',
        activity_safety: '화장실 이동 중 어지럼으로 낙상 직전 상황 발생, 요양보호사 부축으로 외상 없음.',
        other: '보호자(딸) 연락처 메모됨 → 비식별 처리.'
      },
      risk_flags: [
        { level: 'urgent', category: 'activity_safety', finding: '어지럼 동반 낙상 직전(아차사고)', evidence_source: 'bà bị chóng mặt, suýt ngã', action: '간호사에게 즉시 보고, 활력징후(혈압·혈당) 확인, 이동 시 1:1 보조 및 낙상 위험 재평가' },
        { level: 'caution', category: 'meal', finding: '식사 1/3 및 수분 약 2컵 — 섭취 저하', evidence_source: 'ăn sáng chỉ được khoảng 1/3 bát cháo … Uống nước ít, khoảng 2 cốc', action: '섭취량 기록 지속, 탈수 징후 관찰, 선호 음식·수분 제공 방법 검토' },
        { level: 'caution', category: 'physical', finding: '왼쪽 무릎 발적·부종', evidence_source: 'Đầu gối trái hơi đỏ và sưng nhẹ', action: '간호사 확인 요청, 통증 여부 및 변화 관찰' },
        { level: 'observe', category: 'sleep', finding: '야간 2회 각성', evidence_source: 'thức dậy 2 lần gọi con gái', action: '야간 수면 양상 추적 관찰' }
      ],
      term_mapping: [
        { source: 'suýt ngã', standard_ko: '낙상 직전(아차사고)' },
        { source: 'chóng mặt', standard_ko: '어지럼(현훈)' },
        { source: 'hơi đỏ và sưng nhẹ', standard_ko: '경미한 발적 및 부종' },
        { source: 'thuốc huyết áp', standard_ko: '혈압약(항고혈압제)' }
      ],
      clarifications: [
        { question_ko: '어지러우셨을 때 혈압을 측정했나요? 측정했다면 수치는요?', question_source: 'Khi bà bị chóng mặt, chị có đo huyết áp không? Nếu có thì bao nhiêu?' },
        { question_ko: '무릎이 붉어진 것은 넘어질 뻔한 이후인가요, 그 전부터인가요?', question_source: 'Đầu gối bị đỏ là sau khi suýt ngã hay từ trước?' }
      ],
      confidence: 'high'
    }
  },
  {
    id: 'en-dysphagia',
    lang: 'en',
    label: '🇵🇭 영어 · 삼킴곤란/욕창의심',
    memo: 'Mr. Lee in room 108 coughed a lot while eating lunch, especially when drinking water. His voice sounded wet after swallowing. He ate about half. No fever, temp 36.8. He refused to take a shower today, said he is cold. Skin on his lower back (sacrum) is red, I changed position every 2 hours. His son called at 3pm, number +82 10 9876 5432.',
    result: {
      source_language: 'en',
      translation_ko: '{{R}}의 {{N}} 어르신이 점심 식사 중, 특히 물을 마실 때 기침을 많이 하셨습니다. 삼킨 후 목소리가 젖은 듯(가르랑거리듯) 들렸습니다. 식사는 절반 정도 하셨습니다. 발열 없음, 체온 36.8℃. 오늘 춥다고 하시며 샤워를 거부하셨습니다. 허리 아래(천골 부위) 피부가 붉어 2시간마다 체위를 변경했습니다. 오후 3시에 아드님이 전화했습니다. 번호 [전화번호].',
      summary_ko: '식사 중 사레·젖은 목소리(삼킴곤란 의심), 천골 발적',
      record: {
        physical: '체온 36.8℃(발열 없음). 천골 부위 피부 발적 관찰됨.',
        meal: '점심 약 1/2 섭취. 식사 중 특히 물 섭취 시 잦은 기침, 삼킨 후 젖은 목소리 관찰됨.',
        excretion: '',
        sleep: '',
        cognition_emotion: '추위를 호소하며 샤워 거부.',
        medication: '',
        activity_safety: '천골 발적으로 2시간마다 체위변경 시행.',
        other: '15시 아들과 통화(연락처 비식별 처리). 목욕 미실시(본인 거부).'
      },
      risk_flags: [
        { level: 'urgent', category: 'meal', finding: '식사 중 사레·젖은 목소리 — 흡인 위험', evidence_source: 'coughed a lot while eating lunch, especially when drinking water. His voice sounded wet after swallowing', action: '간호사 즉시 보고, 다음 식사 전 삼킴 평가 요청, 식사 자세(상체 거상) 및 수분 점도 조절 검토' },
        { level: 'caution', category: 'physical', finding: '천골 부위 발적 — 욕창 초기 의심', evidence_source: 'Skin on his lower back (sacrum) is red', action: '간호사 피부 사정 요청, 체위변경 2시간 간격 유지 및 기록' },
        { level: 'observe', category: 'other', finding: '목욕 거부(추위 호소)', evidence_source: 'He refused to take a shower today, said he is cold', action: '실내 온도 조정 후 부분 청결 또는 일정 재조정' }
      ],
      term_mapping: [
        { source: 'coughed while drinking', standard_ko: '사레들림' },
        { source: 'voice sounded wet', standard_ko: '젖은 목소리(습성 음성) — 흡인 징후' },
        { source: 'sacrum is red', standard_ko: '천골 부위 발적' },
        { source: 'changed position', standard_ko: '체위변경' }
      ],
      clarifications: [
        { question_ko: '발적 부위를 손가락으로 눌렀을 때 하얗게 변했다가 돌아오나요?', question_source: 'When you press the red skin gently, does it turn white and then go back to red?' }
      ],
      confidence: 'high'
    }
  },
  {
    id: 'zh-delirium',
    lang: 'zh',
    label: '🇨🇳 중국어 · 변비/야간 배회',
    memo: '朴奶奶（205号房）这三天没有大便，肚子有点胀，她说不舒服。晚上11点左右她自己下床在走廊走来走去，说要回家找儿子，不认识我。早上又正常了。午饭吃了一半，喝水还可以。下午参加了唱歌活动，心情不错。',
    result: {
      source_language: 'zh',
      translation_ko: '{{N}} 할머니({{R}})는 3일째 대변을 보지 않으셨고, 배가 약간 더부룩하며 불편하다고 하셨습니다. 밤 11시경 혼자 침대에서 내려와 복도를 왔다 갔다 하시며 집에 가서 아들을 찾겠다고 하셨고, 저를 알아보지 못하셨습니다. 아침에는 다시 평소대로 돌아오셨습니다. 점심은 절반 드셨고, 물은 괜찮게 드셨습니다. 오후에 노래 프로그램에 참여하셨고 기분이 좋으셨습니다.',
      summary_ko: '3일 무배변·복부팽만 + 야간 배회·요양보호사 미인지',
      record: {
        physical: '복부 팽만감 및 불편감 호소.',
        meal: '점심 약 1/2 섭취. 수분 섭취 양호.',
        excretion: '3일간 무배변.',
        sleep: '23시경 기상하여 복도 배회.',
        cognition_emotion: '야간 23시경 귀가·아들 찾기 발언, 요양보호사를 알아보지 못함. 아침에는 평소 상태로 회복. 오후 프로그램 참여 시 정서 안정.',
        medication: '',
        activity_safety: '야간 단독 이상(離床) 및 배회 — 낙상 위험.',
        other: '오후 노래 프로그램 참여.'
      },
      risk_flags: [
        { level: 'caution', category: 'cognition_emotion', finding: '야간 급성 혼돈·배회(섬망 가능성)', evidence_source: '晚上11点左右她自己下床在走廊走来走去，说要回家找儿子，不认识我', action: '간호사 보고, 야간 순회 강화, 침상 주변 낙상 예방 조치, 변화 양상 기록' },
        { level: 'caution', category: 'excretion', finding: '3일 무배변 + 복부 팽만', evidence_source: '这三天没有大便，肚子有点胀', action: '간호사 확인, 수분·식이섬유 섭취 및 배변 관리 계획 검토' }
      ],
      term_mapping: [
        { source: '没有大便', standard_ko: '무배변' },
        { source: '肚子胀', standard_ko: '복부 팽만' },
        { source: '走来走去', standard_ko: '배회' },
        { source: '不认识我', standard_ko: '사람 인지 저하(지남력 저하)' }
      ],
      clarifications: [
        { question_ko: '밤에 배회하실 때 넘어지거나 부딪힌 적은 없나요?', question_source: '她晚上走来走去的时候，有没有摔倒或者撞到？' }
      ],
      confidence: 'medium'
    }
  },
  {
    id: 'ko-bp',
    lang: 'ko',
    label: '✍️ 서툰 한국어 · 흉부 답답함/투약거부',
    memo: '최순자 할머니 오늘 아침 약 안드셨어요. 약 뱉었어요. 점심 조금 드셨어요. 오후에 가슴 답답하다고 해서 혈압 쟀어요 160/100. 간호사 선생님께 말했어요. 저녁에는 괜찮다고 하셨어요. 소변 색깔 진해요.',
    result: {
      source_language: 'ko',
      translation_ko: '{{N}} 할머니께서 오늘 아침 약을 드시지 않으셨습니다(약을 뱉으심). 점심은 조금 드셨습니다. 오후에 가슴이 답답하다고 하셔서 혈압을 측정했고 160/100mmHg였습니다. 간호사에게 보고했습니다. 저녁에는 괜찮다고 하셨습니다. 소변 색이 진합니다.',
      summary_ko: '흉부 답답함 + 혈압 160/100, 아침 투약 거부',
      record: {
        physical: '오후 흉부 답답함 호소, 혈압 160/100mmHg 측정. 저녁에는 증상 호전 표현.',
        meal: '점심 소량 섭취.',
        excretion: '소변 색 진함.',
        sleep: '',
        cognition_emotion: '',
        medication: '아침 약 거부(뱉어냄) — 미복용.',
        activity_safety: '',
        other: '흉부 증상 발생 시 간호사에게 보고함.'
      },
      risk_flags: [
        { level: 'urgent', category: 'physical', finding: '흉부 답답함 + 수축기 혈압 160', evidence_source: '가슴 답답하다고 해서 혈압 쟀어요 160/100', action: '간호사 보고 완료 여부 확인, 재측정 및 경과 기록, 재발 시 즉시 의료진 연락' },
        { level: 'caution', category: 'medication', finding: '아침 투약 거부(뱉음)', evidence_source: '아침 약 안드셨어요. 약 뱉었어요', action: '간호사에게 미복용 약 종류 확인 요청, 복약 방법 검토' },
        { level: 'caution', category: 'excretion', finding: '진한 소변 — 수분 부족 가능성', evidence_source: '소변 색깔 진해요', action: '수분 섭취량 확인 및 관찰' }
      ],
      term_mapping: [
        { source: '약 뱉었어요', standard_ko: '투약 거부(약물 뱉어냄)' },
        { source: '가슴 답답하다', standard_ko: '흉부 답답함 호소' },
        { source: '소변 색깔 진해요', standard_ko: '농축뇨 관찰' }
      ],
      clarifications: [
        { question_ko: '뱉으신 약이 어떤 약인지(혈압약 포함 여부) 알 수 있나요?', question_source: '뱉은 약이 무슨 약이에요? 혈압약도 있었어요?' },
        { question_ko: '저녁에 혈압을 다시 쟀나요?', question_source: '저녁에 혈압 다시 쟀어요?' }
      ],
      confidence: 'high'
    }
  }
];

// 데모용 피드백 역번역(사전 생성) — 언어별 1개
window.CB_DEMO_FEEDBACK = {
  vi: { translation: 'Cảm ơn chị đã đỡ bà kịp thời. Từ hôm nay, khi bà đi vệ sinh, chị hãy luôn đi cùng bà (낙상 예방). Nếu bà lại chóng mặt, hãy đo huyết áp và báo ngay cho y tá.', back_translation_ko: '어르신을 제때 부축해 주셔서 감사합니다. 오늘부터 어르신이 화장실에 가실 때는 항상 함께 가 주세요(낙상 예방). 다시 어지러워하시면 혈압을 재고 바로 간호사에게 알려 주세요.', key_terms: [{ ko: '낙상 예방', target: 'phòng ngừa té ngã' }] },
  en: { translation: 'Thank you for the careful report. Please raise his upper body when he eats and give water slowly in small sips (사레 예방). Tell the nurse right away if he coughs again.', back_translation_ko: '꼼꼼한 보고 감사합니다. 식사하실 때 상체를 세워 드리고 물은 조금씩 천천히 드려 주세요(사레 예방). 다시 기침하시면 바로 간호사에게 알려 주세요.', key_terms: [{ ko: '사레', target: 'choking/coughing while swallowing' }] },
  zh: { translation: '谢谢您的记录。今晚请每小时去看一下奶奶，床边放好防滑垫（낙상 예방）。如果她又在走廊走来走去，请轻声陪她并告诉护士。', back_translation_ko: '기록 감사합니다. 오늘 밤에는 매시간 할머니를 확인해 주시고, 침대 옆에 미끄럼 방지 매트를 놓아 주세요(낙상 예방). 다시 복도를 배회하시면 부드럽게 곁에 계셔 주시고 간호사에게 알려 주세요.', key_terms: [{ ko: '배회', target: '走来走去' }] },
  ko: { translation: '보고 잘했어요. 오늘 저녁에 혈압 한 번 더 재 주세요. 약 뱉으시면 바로 간호사 선생님께 말해 주세요. 물 자주 드려 주세요.', back_translation_ko: '(한국어 — 쉬운 문장으로 다듬음)', key_terms: [{ ko: '혈압', target: '혈압(피 압력)' }] }
};
