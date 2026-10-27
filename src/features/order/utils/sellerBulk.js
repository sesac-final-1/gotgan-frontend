// 판매자 일괄 처리 결과 { succeeded, failed[{ orderItemId, code, message }] } → 화면 표시 — 담당 이경석
import { FLOW, FLOW_STATUS } from '@/features/order/constants';

// 토스트 요약 — "2건 발주확인 완료" / "2건 발주확인 완료 · 1건 실패"
export function bulkSummary(action, { succeeded, failed }) {
  const done = succeeded.length ? `${succeeded.length}건 ${action} 완료` : `${action}하지 못했어요`;
  return failed.length ? `${done} · ${failed.length}건 실패 (표에서 사유 확인)` : done;
}

// 행마다 실패 사유 — orderItemId → message
export const failureMap = ({ failed }) => Object.fromEntries(failed.map((f) => [f.orderItemId, f.message]));

// 상태 탭 라벨(결제완료 …) ↔ API 상태 코드(PAYMENT_DONE …). '전체'는 null
export const statusOfTab = (tab) => FLOW_STATUS[FLOW.indexOf(tab)] ?? null;
export const tabCounts = (statusCounts = {}) => {
  const counts = Object.fromEntries(FLOW.map((t, i) => [t, statusCounts[FLOW_STATUS[i]] ?? 0]));
  return { 전체: Object.values(statusCounts).reduce((n, c) => n + c, 0), ...counts };
};

// 송장 입력 모달의 행 → ship 요청. 송장번호를 비우면 null (서버가 mock 번호 — 빈 문자열은 형식 오류)
export const toShipItems = (rows, inputs, defaultCourier) => rows.map((r) => ({
  orderItemId: r.orderItemId,
  courier: inputs[r.orderItemId]?.courier || defaultCourier,
  trackingNo: inputs[r.orderItemId]?.trackingNo?.trim() || null,
}));
