// 회원등급 · 포인트 — 담당 이경석
// 등급: 누적 구매확정 금액 기준 (NORMAL < SILVER 30만 < GOLD 80만) · 혜택은 표시만, 적립률은 5% 고정
export const GRADES = [
  { id: 'NORMAL', label: '일반', min: 0 },
  { id: 'SILVER', label: '실버', min: 300000 },
  { id: 'GOLD', label: '골드', min: 800000 },
];
export const gradeById = Object.fromEntries(GRADES.map((g) => [g.id, g]));
export const nextGrade = (spent) => GRADES.find((g) => g.min > spent) || null;

// 포인트: 실결제금액(포인트 사용분 제외)의 5% 적립 · 취소/반품 시 적립분 회수 · 사용분 환원
export const POINT_RATE = 0.05;
export const earnOf = (paid) => Math.floor(paid * POINT_RATE);
export const POINT_TYPES = ['적립', '사용', '회수', '환원'];
