// 결제수단 — 담당 구지훈. 포트원 V2 · 토스페이먼츠 테스트 채널에서 지원하는 것만 (무통장입금 · 곳간페이는 범위 밖, 10/26)
// 간편결제는 카드와 같은 흐름(결제창 → 결제 확인)이라 서버 변경 없음 — payment 는 method 를 EASY_PAY 로 기록
export const PAY_METHODS = [
  { label: '신용/체크카드', payMethod: 'CARD' },
  { label: '카카오페이', payMethod: 'EASY_PAY', easyPayProvider: 'KAKAOPAY' },
  { label: '네이버페이', payMethod: 'EASY_PAY', easyPayProvider: 'NAVERPAY' },
  { label: '토스페이', payMethod: 'EASY_PAY', easyPayProvider: 'TOSSPAY' },
];
export const DEFAULT_PAY_METHOD = PAY_METHODS[0];
