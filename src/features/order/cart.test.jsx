import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { useToastStore } from '@/shared/stores/toastStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { addCartItems, checkCartItems, fetchCart, removeCartItems, updateCartItem } from '@/features/order/api/orderApi';
import { useCart } from '@/features/order/hooks/useCart';
import { cartLines, checkoutGroups, clampQty, patchLines } from '@/features/order/utils/cartView';
import { toOrderRequest } from '@/features/order/utils/orderRequest';
import ShopCart from '@/features/order/components/ShopCart';

const INITIAL_AUTH = useAuthStore.getState();
afterEach(() => { cleanup(); vi.restoreAllMocks(); useAuthStore.setState(INITIAL_AUTH, true); });
const login = () => useAuthStore.setState({ user: { id: 4, name: '구매자' } });

// backend CartResponse
const line = (id, extra = {}) => ({ productOptionId: id, productId: id + 100, productName: `상품 ${id}`, optionName: '특', imageUrl: null,
  unitPrice: 10000, quantity: 2, checked: true, purchasable: true, stock: 10, lineAmt: 20000, ...extra });
const CART = {
  stores: [
    { storeId: 1, storeName: '곳간상회', productAmt: 20000, shippingFee: 3000, freeThreshold: 50000, amountToFree: 30000,
      items: [line(11), line(12, { checked: false, quantity: 1, lineAmt: 10000 }), line(13, { purchasable: false })] },
    { storeId: 2, storeName: null, productAmt: 60000, shippingFee: 0, freeThreshold: 50000, amountToFree: 0,
      items: [line(21, { quantity: 6, lineAmt: 60000, stock: 3 })] },
  ],
  unavailable: [{ productOptionId: 99, productId: null, quantity: 1 }],
  cartCount: 5, checkedCount: 3, totalProductAmt: 80000, totalShippingFee: 3000, totalAmt: 83000,
};
const lastToast = () => useToastStore.getState().current?.msg;
const httpError = (status, message) => Object.assign(new Error(String(status)), { response: { status, data: { code: 'X', message } } });

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('cartView', () => {
  it('줄 펼치기 · 주문서 줄(선택된 구매 가능만, 빈 스토어 제외) · 수량 범위', () => {
    expect(cartLines(CART).map((l) => l.productOptionId)).toEqual([11, 12, 13, 21]);
    expect(cartLines(undefined)).toEqual([]);
    expect(checkoutGroups(CART).map((g) => [g.storeId, g.items.map((l) => l.productOptionId)])).toEqual([[1, [11]], [2, [21]]]);
    expect(checkoutGroups(undefined)).toEqual([]);
    expect([clampQty(0), clampQty(5), clampQty(1000)]).toEqual([1, 5, 999]);
  });

  it('낙관적 반영 — 고른 줄(없으면 전체)에 수량 · 선택, 줄 금액은 단가 × 수량', () => {
    const qty = patchLines(CART, [11], { quantity: 3 });
    expect(qty.stores[0].items[0]).toMatchObject({ quantity: 3, lineAmt: 30000 });
    expect(qty.stores[0].items[1].quantity).toBe(1);
    expect(cartLines(patchLines(CART, null, { checked: false })).every((l) => !l.checked)).toBe(true);
    expect(patchLines(undefined, null, {})).toBeUndefined();
  });

  it('주문 요청 — 장바구니 줄의 옵션 ID · 수량', () => {
    const r = toOrderRequest({ lines: [line(11)], address: { name: 'n', phone: 'p', zip: 'z', addr: 'a', detail: null }, memo: '', point: 0 });
    expect(r.items).toEqual([{ productOptionId: 11, quantity: 2 }]);
  });
});

describe('장바구니 API', () => {
  it('조회 · 담기 · 삭제(쉼표로 이은 ID) · 줄 수정 · 선택 한꺼번에 경로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: CART } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: 'ok' } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: { data: 'ok' } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: 'ok' } });

    expect(await fetchCart()).toBe(CART);
    await addCartItems([{ productOptionId: 11, quantity: 1 }]);
    await removeCartItems([11, 12]);
    await updateCartItem(11, { quantity: 3 });
    await checkCartItems(false, undefined);

    expect(get).toHaveBeenCalledWith('/api/carts');
    expect(post).toHaveBeenCalledWith('/api/carts/items', { items: [{ productOptionId: 11, quantity: 1 }] });
    expect(del).toHaveBeenCalledWith('/api/carts/items', { params: { productOptionIds: '11,12' } });
    expect(patch).toHaveBeenNthCalledWith(1, '/api/carts/items/11', { quantity: 3 });
    expect(patch).toHaveBeenNthCalledWith(2, '/api/carts/items/checked', { checked: false, productOptionIds: undefined });
  });
});

describe('useCart', () => {
  function renderCart(qc = client()) {
    const wrapper = ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return { qc, ...renderHook(() => useCart(), { wrapper }) };
  }

  it('로그인 전에는 부르지 않고 배지 0', () => {
    const get = vi.spyOn(axiosInstance, 'get');
    const { result } = renderCart();
    expect(result.current.cartCount).toBe(0);
    expect(result.current.lines).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('수량은 바로 반영 후 서버 값으로 다시, 실패하면 되돌리고 서버 메시지 · 한 줄은 줄 수정 · 전체는 선택 한꺼번에', async () => {
    login();
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: CART } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockImplementationOnce(() => new Promise(() => {}))   // 응답 대기 — 낙관적 반영 확인
      .mockRejectedValueOnce(httpError(404, '장바구니에 없는 상품입니다.')).mockResolvedValue({ data: { data: {} } });
    const { qc, result } = renderCart();
    await waitFor(() => expect(result.current.cartCount).toBe(5));

    act(() => result.current.setQty(11, 4));
    await waitFor(() => expect(qc.getQueryData(queryKeys.order.cart()).stores[0].items[0].quantity).toBe(4));
    expect(patch).toHaveBeenCalledWith('/api/carts/items/11', { quantity: 4 });

    act(() => result.current.toggleLine(12, true));
    await waitFor(() => expect(lastToast()).toBe('장바구니에 없는 상품입니다.'));

    act(() => result.current.toggleAll(false));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/carts/items/checked', { checked: false, productOptionIds: undefined }));
  });

  it('담기 · 삭제 — 성공 true, 실패 false + 서버 메시지', async () => {
    login();
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: CART } });
    vi.spyOn(axiosInstance, 'post').mockResolvedValueOnce({ data: { data: {} } }).mockRejectedValueOnce(httpError(409, '장바구니에 담을 수 없는 상품입니다.'));
    vi.spyOn(axiosInstance, 'delete').mockRejectedValueOnce(httpError(500, undefined));
    const { result } = renderCart();

    let ok;
    await act(async () => { ok = await result.current.addToCart([{ productOptionId: 11, quantity: 1 }]); });
    expect(ok).toBe(true);
    await act(async () => { ok = await result.current.addToCart([{ productOptionId: 99, quantity: 1 }]); });
    expect(ok).toBe(false);
    expect(lastToast()).toBe('장바구니에 담을 수 없는 상품입니다.');
    await act(async () => { ok = await result.current.removeLines([11]); });
    expect(ok).toBe(false);
    expect(lastToast()).toBe('삭제하지 못했어요.');
  });
});

describe('ShopCart — 서버 장바구니 화면', () => {
  function renderPage() {
    login();
    render(<QueryClientProvider client={client()}><MemoryRouter><ShopCart /></MemoryRouter></QueryClientProvider>);
  }

  it('스토어 묶음 · 무료배송까지 남은 금액 · 구매 불가 · 재고 부족 · 판매 종료, +/− · 체크 · 삭제 · 선택삭제 · 합계', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: CART } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: {} } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: { data: {} } });
    renderPage();

    expect(await screen.findByText('곳간상회')).toBeInTheDocument();
    expect(screen.getByText('30,000원 더 담으면 무료배송')).toBeInTheDocument();
    expect(screen.getByText('무료배송')).toBeInTheDocument();
    expect(screen.getByText('지금은 구매할 수 없는 상품이에요 (주문에서 빠져요)')).toBeInTheDocument();
    expect(screen.getByText('재고가 3개 남았어요')).toBeInTheDocument();
    expect(screen.getByText('판매가 끝난 상품 1개')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2개 상품 주문하기' })).toBeEnabled();   // 선택 · 구매 가능 11 · 21
    expect(screen.getByText('83,000원')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '수량 늘리기' })[0]);
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/carts/items/11', { quantity: 3 }));
    fireEvent.click(screen.getAllByRole('checkbox')[2]);   // 0: 전체선택, 1: 11, 2: 12
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/carts/items/12', { checked: true }));

    fireEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/carts/items', { params: { productOptionIds: '11' } }));
    fireEvent.click(screen.getByRole('button', { name: '모두 삭제' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/carts/items', { params: { productOptionIds: '99' } }));
    fireEvent.click(screen.getByRole('button', { name: '선택삭제' }));
    await waitFor(() => expect(lastToast()).toBe('선택한 상품을 삭제했어요'));
  });

  it('빈 장바구니 · 선택 없음 삭제 안내 · 조회 실패', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValueOnce({ data: { data: { ...CART, stores: [], unavailable: [], cartCount: 0, checkedCount: 0 } } });
    renderPage();
    expect(await screen.findByText('장바구니가 비어 있어요')).toBeInTheDocument();
    cleanup();

    get.mockResolvedValueOnce({ data: { data: { ...CART, unavailable: [], stores: [{ ...CART.stores[0], productAmt: 0, shippingFee: 0, amountToFree: 0,
      items: [line(12, { checked: false })] }] } } });
    renderPage();
    expect(await screen.findByText('선택한 상품 없음')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '선택삭제' }));
    expect(lastToast()).toBe('삭제할 상품을 선택해 주세요');
    cleanup();

    get.mockRejectedValueOnce(httpError(502, 'x'));
    renderPage();
    expect(await screen.findByText('장바구니를 불러오지 못했어요')).toBeInTheDocument();
  });
});
