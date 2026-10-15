import { create } from 'zustand';

// 장바구니 — 목업 전용 클라이언트 상태 (새로고침하면 초기화). 담당 이경석
// ⚠ 실제: 장바구니 원본은 order-service MySQL cart_item + Redis 캐시 → useCartQuery + 변경 mutation 으로 교체 (docs/MOCK-TO-API.md)
const INITIAL = [
  { key: 'p402|S+M+L', productId: 'p402', option: 'S+M+L', qty: 1, checked: true },
  { key: 'p702|하루 (산미)', productId: 'p702', option: '하루 (산미)', qty: 2, checked: true },
  { key: 'p303|탄', productId: 'p303', option: '탄', qty: 1, checked: false },
];

export const useCartMockStore = create((set) => ({
  items: INITIAL,
  add: (productId, option, qty = 1) =>
    set(({ items }) => {
      const key = `${productId}|${option}`;
      const hit = items.find((i) => i.key === key);
      return { items: hit ? items.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i)) : [...items, { key, productId, option, qty, checked: true }] };
    }),
  setQty: (key, qty) => set(({ items }) => ({ items: items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)) })),
  toggleLine: (key) => set(({ items }) => ({ items: items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)) })),
  toggleAll: (on) => set(({ items }) => ({ items: items.map((i) => ({ ...i, checked: on })) })),
  removeLines: (keys) => set(({ items }) => ({ items: items.filter((i) => !keys.includes(i.key)) })),
  clearChecked: () => set(({ items }) => ({ items: items.filter((i) => !i.checked) })),
}));
