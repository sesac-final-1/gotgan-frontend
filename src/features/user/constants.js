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

// 서버 point_history.type → 화면 구분 · 부호 · 기본 문구 (서버 amount 는 항상 양수 — 증감은 type 으로)
export const POINT_TYPE_BY_CODE = {
  EARN: { label: '적립', sign: 1, desc: `결제 적립 ${POINT_RATE * 100}%` },
  USE: { label: '사용', sign: -1, desc: '주문 결제 사용' },
  RESTORE: { label: '환원', sign: 1, desc: '취소 · 반품 사용 포인트 환원' },
  RECLAIM: { label: '회수', sign: -1, desc: '취소 · 반품 적립 포인트 회수' },
};

// 배송지 — 회원당 최대 개수 (서버 AddressService.MAX_ADDRESSES 와 같게, 넘으면 409 ADDRESS_LIMIT_EXCEEDED)
export const MAX_ADDRESSES = 5;

// 가입 경로 — LOCAL 이 아니면(소셜 가입) Keycloak 비밀번호가 없어 비밀번호 변경 불가
export const SIGNUP_PROVIDER_LABELS = { KAKAO: '카카오', NAVER: '네이버', GOOGLE: 'Google' };

// 프로필 사진 — 서버에 없음(백엔드 범위 밖), 모든 회원 같은 기본 이미지
export const DEFAULT_AVATAR = '/images/avatar/default.svg';
