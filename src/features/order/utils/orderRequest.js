// 주문 생성 요청 (backend OrderCreateRequest) — 담당 이경석. 금액은 보내지 않는다: 서버가 product 현재가 · 스토어 배송비로 다시 계산
// lines = 장바구니 응답의 선택된 줄 (productOptionId · quantity)
export const toOrderRequest = ({ lines, address, memo, point }) => ({
  items: lines.map((l) => ({ productOptionId: l.productOptionId, quantity: l.quantity })),
  receiverName: address.name,
  receiverPhone: address.phone,
  zipcode: address.zip,
  address1: address.addr,
  address2: address.detail || null,
  deliveryMemo: memo?.trim() || null,
  usePoint: point,
});
