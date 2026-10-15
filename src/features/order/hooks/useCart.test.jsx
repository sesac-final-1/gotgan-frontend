import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/queryWrapper';
import { useCart } from '@/features/order/hooks/useCart';
import { useCartMockStore } from '@/features/order/stores/cartMockStore';

// 장바구니 — 반환 모양은 API 교체 후에도 유지 (docs/MOCK-TO-API.md) → 이 테스트가 교체 후 회귀 확인용
const INITIAL = useCartMockStore.getState().items;
beforeEach(() => useCartMockStore.setState({ items: INITIAL }));

async function renderCart() {
  const { Wrapper } = createWrapper();
  const hook = renderHook(() => useCart(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.cart.length).toBeGreaterThan(0));
  return hook.result;
}

describe('useCart', () => {
  it('상품 정보 · 할인 단가를 붙여 돌려준다', async () => {
    const r = await renderCart();
    expect(r.current.cartCount).toBe(3);
    const line = r.current.cart[0];
    expect(line.product.id).toBe(line.productId);
    expect(line.unit).toBeLessThanOrEqual(line.product.price);
  });

  it('같은 상품 · 옵션을 담으면 수량 합산, 다르면 새 줄', async () => {
    const r = await renderCart();
    act(() => r.current.addToCart('p402', 'S+M+L', 2));
    expect(r.current.cart.find((l) => l.key === 'p402|S+M+L').qty).toBe(3);
    act(() => r.current.addToCart('p402', 'XL'));
    expect(r.current.cartCount).toBe(4);
    expect(r.current.cart.find((l) => l.key === 'p402|XL')).toMatchObject({ qty: 1, checked: true });
  });

  it('수량은 1 미만으로 내려가지 않는다', async () => {
    const r = await renderCart();
    act(() => r.current.setQty('p702|하루 (산미)', 0));
    expect(r.current.cart.find((l) => l.key === 'p702|하루 (산미)').qty).toBe(1);
  });

  it('선택 토글 · 전체 선택 · 선택 삭제 · 줄 삭제', async () => {
    const r = await renderCart();
    act(() => r.current.toggleLine('p303|탄'));
    expect(r.current.cart.every((l) => l.checked)).toBe(true);
    act(() => r.current.toggleAll(false));
    expect(r.current.cart.some((l) => l.checked)).toBe(false);
    act(() => r.current.toggleLine('p303|탄'));
    act(() => r.current.clearChecked());
    expect(r.current.cart.map((l) => l.key)).not.toContain('p303|탄');
    act(() => r.current.removeLines(['p402|S+M+L']));
    expect(r.current.cartCount).toBe(1);
  });
});
