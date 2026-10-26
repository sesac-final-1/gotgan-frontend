// 관리자 상수 — 담당 구지훈 (회원 이용정지 · 해제 매핑은 user 내부 API 계약 기준, 10/22 노션 "user 내부 API 연동 안내")

// 정지 기간 — 모달 선택값 → 요청 days (생략 = 영구, 기간이 끝나면 user-service 가 자동 해제)
export const SUSPEND_DURATIONS = [
  { value: '7', label: '7일', days: 7 },
  { value: '30', label: '30일', days: 30 },
  { value: 'permanent', label: '영구', days: null },
];

// 정지 사유 — 선택한 문구가 그대로 reason (user users.status_reason, 255자 이하)
export const SUSPEND_REASONS = ['허위 리뷰 / 리뷰 어뷰징', '결제 도용 의심', '욕설 · 비방'];

/**
 * PATCH /api/admin/users/{id}/status 요청 본문 — 정지 {status: SUSPENDED, reason, days?} · 해제 {status: ACTIVE, reason}
 * days 가 없으면(영구) 키를 보내지 않는다. 사유는 앞뒤 공백 제거 (빈 사유는 서버가 400 USER_STATUS_REASON_REQUIRED)
 */
export function toUserStatusRequest({ suspend, duration, reason }) {
  if (!suspend) return { status: 'ACTIVE', reason: reason.trim() };
  const days = SUSPEND_DURATIONS.find((d) => d.value === duration)?.days ?? null;
  return { status: 'SUSPENDED', reason: reason.trim(), ...(days ? { days } : {}) };
}

// 상세의 정지 기간 표시 — 종료 시각이 없으면 영구
export const suspensionLabel = (suspendedUntil, format) => (suspendedUntil ? `${format(suspendedUntil)}까지` : '영구');

// 정산 주차 = 월 ~ 일(KST), API 는 ISO 주차("2026-W43" — 그 주 목요일이 속한 해의 몇째 주)
export const isoWeek = (monday) => {
  const thu = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const firstThu = new Date(thu.getFullYear(), 0, 4 + 3 - ((jan4.getDay() + 6) % 7));
  return `${thu.getFullYear()}-W${String(1 + Math.round((thu - firstThu) / (7 * 864e5))).padStart(2, '0')}`;
};

// 정산 관리 주차 선택 — 지난주부터 8주 (최신 순). 첫 항목이 기본값 = 서버의 week 생략과 같은 지난주
export const recentWeeks = (today = new Date()) =>
  Array.from({ length: 8 }, (_, i) => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 7 * (i + 1));
    return { key: isoWeek(start), start };
  });

// 입점 심사 — store 내부 API 값 → 화면 라벨 (store.md 2 · 3절)
export const APPLICATION_STATUS_LABEL = { PENDING: '심사대기', SUPPLEMENT: '보완요청', APPROVED: '승인', REJECTED: '반려' };
export const BIZ_TYPE_LABEL = { INDIVIDUAL: '개인', CORPORATE: '법인' };
export const EXPECTED_SALES_LABEL = { UNDER_5M: '월 500만원 미만', FROM_5M_TO_20M: '월 500만 ~ 2,000만원', FROM_20M_TO_100M: '월 2,000만 ~ 1억원', OVER_100M: '월 1억원 이상' };
// 처리자는 종류만 내려온다 — 관리자 개인 이름은 저장하지 않음 (store.md 관리자 공통)
export const ACTOR_LABEL = { APPLICANT: '신청자', ADMIN: '곳간 운영팀', SYSTEM: '자동 처리', SELLER: '판매자' };
// 서류 종류 — 보완요청 requestedDocs 와 같은 값 (상품 사진은 3~10장)
export const DOC_TYPES = [
  { value: 'BUSINESS_REG', label: '사업자등록증' },
  { value: 'ECOMMERCE_REG', label: '통신판매업 신고증' },
  { value: 'BANK_COPY', label: '통장 사본' },
  { value: 'PRODUCT_PHOTO', label: '상품 사진' },
];

// 신고 처리 — 대상마다 할 수 있는 조치 (backend docs/api/admin.md 4절). SUSPEND 만 기간(days) — 정지 기간 선택지는 SUSPEND_DURATIONS
export const REPORT_ACTIONS = {
  REVIEW: [{ value: 'BLIND', label: '블라인드' }, { value: 'UNBLIND', label: '블라인드 해제' }, { value: 'DISMISS', label: '기각 (조치 없음)' }],
  USER: [{ value: 'SUSPEND', label: '이용정지' }, { value: 'UNSUSPEND', label: '정지 해제' }, { value: 'DISMISS', label: '기각 (조치 없음)' }],
};
export const REPORT_ACTION_LABEL = { BLIND: '블라인드', UNBLIND: '블라인드 해제', SUSPEND: '이용정지', UNSUSPEND: '정지 해제', DISMISS: '기각' };
export const REPORT_STATUS_LABEL = { OPEN: '처리대기', RESOLVED: '조치완료', DISMISSED: '기각' };
