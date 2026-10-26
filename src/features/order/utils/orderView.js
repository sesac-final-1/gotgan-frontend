// 내 주문 응답(backend OrderSummaryResponse · OrderDetailResponse) → 화면 표시 — 담당 이경석
import { CLAIM_REASONS, FLOW, FLOW_STATUS, ITEM_STATUS_LABEL, ORDER_STATUS_LABEL } from '@/features/order/constants';

// 시각은 오프셋 없는 Asia/Seoul LocalDateTime(2026-10-26T12:00:00) — 브라우저 현지 시각으로 읽는다
export const toDate = (s) => (s ? new Date(s) : null);

// 결제 대기 · 실패 주문의 상품주문은 ORDERED(주문완료)로 남는다 → 주문 상태(결제대기 · 결제실패)로 보여 준다
export const lineStatusLabel = (order, item) => ORDER_STATUS_LABEL[order.status] ?? ITEM_STATUS_LABEL[item.status] ?? item.status;

// 상단 진행 단계 개수 — statusCounts(모든 상태 키)에서 FLOW 순서대로 [라벨, 개수]
export const flowCounts = (statusCounts = {}) => FLOW_STATUS.map((s, i) => [FLOW[i], statusCounts[s] ?? 0]);

// 진행 중 클레임 개수 (마이페이지 메뉴 배지)
export const openClaimCount = (statusCounts = {}) =>
  ['CANCEL_REQUESTED', 'RETURN_REQUESTED', 'EXCHANGE_REQUESTED'].reduce((n, s) => n + (statusCounts[s] ?? 0), 0);

// 상품주문번호(20261026-000001-01) → 주문번호 — 클레임 신청 경로 /mypage/claim/:lineId 의 lineId 가 상품주문번호
export const orderNoOf = (itemNo) => itemNo.slice(0, itemNo.lastIndexOf('-'));

// 신청할 수 있는 클레임 — 결제완료: 즉시 취소(CLM-01), 배송완료: 반품 · 교환(7일 이내는 서버가 판단). 배송준비 취소요청(CLM-02)은 아직 서버에 없음
export const claimTypesOf = (status) => ({ PAYMENT_DONE: ['CANCEL'], DELIVERED: ['RETURN', 'EXCHANGE'] })[status] ?? [];

// 클레임 접수 결과 안내 — 취소 COMPLETED(환불 끝) · APPROVED(환불 처리 중, 서버가 마저 진행), 반품 · 교환 REQUESTED
export function claimDoneMessage({ type, status }) {
  if (type === 'CANCEL') return status === 'COMPLETED' ? '주문을 취소했어요. 결제 금액은 결제수단으로 돌려드려요.' : '취소를 접수했어요. 환불을 처리하고 있어요.';
  return type === 'RETURN' ? '반품을 신청했어요. 판매자 확인 후 회수해 드려요.' : '교환을 신청했어요. 판매자 확인 후 회수해 드려요.';
}

// 판매자 귀책 사유 — 반품 배송비 면제 · 사진 필수
export const isSellerFault = (reasonCode) => CLAIM_REASONS.some((r) => r.code === reasonCode && r.sellerFault);

// 배송 진행 — 상품주문 시각 필드로 최신 단계부터
export const trackingOf = (order, item) => [
  item.confirmedAt && { at: item.confirmedAt, what: '구매확정되었습니다' },
  item.deliveredAt && { at: item.deliveredAt, what: '배송이 완료되었습니다' },
  item.shippedAt && { at: item.shippedAt, what: `상품이 발송되었습니다 (${item.courier} ${item.trackingNo})` },
  order.paidAt && { at: order.paidAt, what: '결제가 완료되었습니다' },
  { at: order.orderedAt, what: '주문이 접수되었습니다' },
].filter(Boolean).map((t) => ({ ...t, at: toDate(t.at) }));

// 결제수단 — payment.method (포트원 결제수단, 간편결제는 EASY_PAY)
export const payMethodLabel = (payment) => ({ CARD: '카드', EASY_PAY: '간편결제' })[payment?.method] ?? (payment?.method || '포인트 결제');
