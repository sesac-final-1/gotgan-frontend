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
