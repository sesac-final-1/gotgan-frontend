// 주문 상태 흐름 · 클레임 — 담당 이경석 (가이드라인 10장)
// 결제완료 → 배송준비(발주확인) → 배송중(송장등록) → 배송완료 → 구매확정(수동 or 배송완료 7일 후 자동)
// 클레임: 취소요청 → 취소완료 / 반품요청 → 반품완료 / 교환요청 → 교환완료. 정산은 '구매확정'된 주문상품만 대상
export const FLOW = ['결제완료', '배송준비', '배송중', '배송완료', '구매확정'];
export const CLAIMS = ['취소요청', '취소완료', '반품요청', '반품완료', '교환요청', '교환완료'];
export const CLAIM_TYPE = { 취소요청: '취소', 취소완료: '취소', 반품요청: '반품', 반품완료: '반품', 교환요청: '교환', 교환완료: '교환' };
export const STATUS_TONE = {
  결제완료: 'sky', 배송준비: 'amber', 배송중: 'moss', 배송완료: 'ink', 구매확정: 'mute',
  취소요청: 'rust', 취소완료: 'mute', 반품요청: 'rust', 반품완료: 'mute', 교환요청: 'rust', 교환완료: 'mute',
};

// API 상태 코드 → 화면 라벨 (backend OrderItemStatus · OrderStatus). FLOW_STATUS 는 FLOW 와 같은 순서
export const FLOW_STATUS = ['PAYMENT_DONE', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CONFIRMED'];
export const ITEM_STATUS_LABEL = {
  ORDERED: '주문완료', PAYMENT_DONE: '결제완료', PREPARING: '배송준비', SHIPPING: '배송중', DELIVERED: '배송완료', CONFIRMED: '구매확정',
  CANCEL_REQUESTED: '취소요청', CANCELLED: '취소완료', RETURN_REQUESTED: '반품요청', RETURNED: '반품완료', EXCHANGE_REQUESTED: '교환요청',
};
// 결제 대기(결제창 진행 중 · 닫음 — 결제가 확인되지 않으면 서버가 잠시 뒤 자동 취소, ORD-07) · 결제 실패(만료 · 금액 불일치 · 보상 끝남)
export const ORDER_STATUS_LABEL = { PENDING: '결제대기', FAILED: '결제실패' };
export const CLAIM_TYPE_LABEL = { CANCEL: '취소', RETURN: '반품', EXCHANGE: '교환' };
// 클레임 상태 (backend ClaimStatus) — 화면은 유형 + 단계로 표시 (반품요청 · 반품완료 …)
export const CLAIM_STEP_LABEL = { REQUESTED: '요청', APPROVED: '승인', COLLECTED: '수거완료', RESHIPPED: '재배송중', REJECTED: '거부', COMPLETED: '완료' };
// 클레임 사유 (backend ClaimReasonCode) — 취소는 판매자 귀책 사유 없음
export const CLAIM_REASONS = [
  { code: 'CHANGE_OF_MIND', label: '단순 변심', types: ['CANCEL', 'RETURN', 'EXCHANGE'] },
  { code: 'DELAYED', label: '배송 지연', types: ['CANCEL'] },
  { code: 'DEFECTIVE', label: '상품 불량 · 파손', types: ['RETURN', 'EXCHANGE'], sellerFault: true },
  { code: 'WRONG_DELIVERY', label: '오배송', types: ['RETURN', 'EXCHANGE'], sellerFault: true },
  { code: 'ETC', label: '기타 (상세 사유에 적어 주세요)', types: ['CANCEL', 'RETURN', 'EXCHANGE'] },
];
