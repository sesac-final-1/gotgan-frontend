import { useMemo } from 'react';
import { useCartMockStore } from '@/features/order/stores/cartMockStore';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { salePrice } from '@/shared/utils/format';
import { toMap } from '@/shared/utils/collection';

// 장바구니 — 목업 AppProvider 의 cart API 와 같은 모양 { cart, cartCount, addToCart, setQty, toggleLine, toggleAll, removeLines, clearChecked }
// 담당 이경석 — API 준비 시 useCartQuery(GET /api/carts) + mutation 으로 내부만 교체하고 반환 모양은 유지 (화면 수정 최소화)
export function useCart() {
  const s = useCartMockStore();
  const { data: products = [] } = useProductsQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const cart = useMemo(
    () => s.items.filter((i) => productById[i.productId]).map((i) => ({ ...i, product: productById[i.productId], unit: salePrice(productById[i.productId]) })),
    [s.items, productById],
  );
  return {
    cart,
    cartCount: s.items.length,
    addToCart: s.add,
    setQty: s.setQty,
    toggleLine: s.toggleLine,
    toggleAll: s.toggleAll,
    removeLines: s.removeLines,
    clearChecked: s.clearChecked,
  };
}
