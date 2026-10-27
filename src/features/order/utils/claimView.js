// 클레임 응답(backend ClaimDetailResponse) → 화면 표시 · 판매자 다음 처리 — 담당 이경석
import { CLAIM_REASONS, CLAIM_STEP_LABEL, CLAIM_TYPE_LABEL } from '@/features/order/constants';

// 상태 배지 — 반품요청 · 반품승인 · 반품수거완료 · 교환재배송중 · 반품완료 · 반품거부 (취소 진행 중은 "취소중")
export function claimStatusLabel({ type, status }) {
  if (type === 'CANCEL' && status === 'APPROVED') return '취소중';
  return `${CLAIM_TYPE_LABEL[type] ?? type}${CLAIM_STEP_LABEL[status] ?? status}`;
}

export const reasonLabel = (code) => CLAIM_REASONS.find((r) => r.code === code)?.label.replace(/ \(.*\)$/, '') ?? code;

// 판매자가 지금 할 일 — 요청: 승인 · 거부, 승인: 수거 완료, 교환 수거완료: 재배송 송장. 취소는 자동(판매자 할 일 없음)
export function nextAction({ type, status }) {
  if (type === 'CANCEL') return null;
  if (status === 'REQUESTED') return { action: 'approve', label: '승인 (수거 요청)', rejectable: true };
  if (status === 'APPROVED') return { action: 'collect', label: type === 'RETURN' ? '수거 완료 · 환불' : '수거 완료' };
  if (status === 'COLLECTED' && type === 'EXCHANGE') return { action: 'reship', label: '재배송 송장' };
  return null;
}

// 구매자가 철회할 수 있는지 — 반품 · 교환이 판매자 승인 전일 때만 (취소는 즉시 처리)
export const canWithdraw = ({ type, status }) => type !== 'CANCEL' && status === 'REQUESTED';

// 처리 안내 (구매자 · 판매자 상세)
export function claimProgress({ type, status, rejectReason }) {
  switch (status) {
    case 'REQUESTED': return '판매자 확인 중이에요.';
    case 'APPROVED': return type === 'CANCEL' ? '환불을 처리하고 있어요.' : '승인되었어요. 상품을 회수하고 있어요.';
    case 'COLLECTED': return type === 'RETURN' ? '회수 완료 — 환불을 처리하고 있어요.' : '회수 완료 — 곧 같은 옵션으로 다시 보내 드려요.';
    case 'RESHIPPED': return '교환 상품을 다시 보냈어요. 배송완료되면 교환이 끝나요.';
    case 'REJECTED': return `판매자가 거부했어요 — ${rejectReason ?? ''}`.trim();
    case 'WITHDRAWN': return '요청을 철회했어요.';
    default: return `${CLAIM_TYPE_LABEL[type] ?? type} 처리가 끝났어요.`;
  }
}
