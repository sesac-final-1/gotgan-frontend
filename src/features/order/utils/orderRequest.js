// 주문 생성 요청 (backend OrderCreateRequest) — 담당 이경석. 금액은 보내지 않는다: 서버가 product 현재가 · 스토어 배송비로 다시 계산
// TODO(이경석, 다음 PR): 장바구니 · 상품 API 연동 후 줄에 productOptionId 가 생긴다 — 지금 목업 장바구니 줄에는 없어 서버가 400 INVALID_INPUT
export const toOrderRequest = ({ lines, address, memo, point }) => ({
  items: lines.map((l) => ({ productOptionId: l.productOptionId, quantity: l.qty })),
  receiverName: address.name,
  receiverPhone: address.phone,
  zipcode: address.zip,
  address1: address.addr,
  address2: address.detail || null,
  deliveryMemo: memo?.trim() || null,
  usePoint: point,
});
