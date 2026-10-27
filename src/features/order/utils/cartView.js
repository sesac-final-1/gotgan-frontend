// 장바구니 응답(backend CartResponse) 다루기 — 담당 이경석. 금액 · 배송비는 서버 계산값을 그대로 쓴다 (선택된 구매 가능 줄 기준)

export const MAX_QTY = 999;

// 모든 줄 (스토어 순서 그대로)
export const cartLines = (cart) => cart?.stores.flatMap((s) => s.items) ?? [];

// 주문서로 넘길 줄 — 선택됐고 구매 가능한 것만, 스토어 묶음을 유지
export const checkoutGroups = (cart) => (cart?.stores ?? [])
  .map((s) => ({ ...s, items: s.items.filter((l) => l.checked && l.purchasable) }))
  .filter((s) => s.items.length > 0);

// 낙관적 업데이트 — ids(없으면 전체) 줄에 { quantity?, checked? } 를 바로 반영 (금액 · 배송비는 서버 응답으로 다시 맞춘다)
export function patchLines(cart, ids, change) {
  if (!cart) return cart;
  const hit = (id) => ids == null || ids.includes(id);
  return {
    ...cart,
    stores: cart.stores.map((s) => ({
      ...s,
      items: s.items.map((l) => (hit(l.productOptionId) ? { ...l, ...change, lineAmt: l.unitPrice * (change.quantity ?? l.quantity) } : l)),
    })),
  };
}

// 수량 버튼 범위 (1 ~ 999)
export const clampQty = (qty) => Math.max(1, Math.min(MAX_QTY, qty));
