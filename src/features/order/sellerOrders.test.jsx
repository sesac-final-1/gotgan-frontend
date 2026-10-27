import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { useToastStore } from '@/shared/stores/toastStore';
import { confirmOrderItems, deliverOrderItems, fetchSellerOrderItem, fetchSellerOrderItems, shipOrderItems } from '@/features/order/api/orderApi';
import { useSellerOrderItemQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useConfirmOrderItemsMutation } from '@/features/order/hooks/useSellerDeliveryMutations';
import { bulkSummary, failureMap, statusOfTab, tabCounts, toShipItems } from '@/features/order/utils/sellerBulk';
import SellerOrderList from '@/features/order/components/SellerOrderList';
import SellerOrderDetail from '@/features/order/components/SellerOrderDetail';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// backend SellerOrderItemResponse
const row = (id, status, extra = {}) => ({
  orderItemId: id, itemNo: `20261027-000001-0${id - 455}`, orderNo: '20261027-000001', orderedAt: '2026-10-27T10:00:00', paidAt: '2026-10-27T10:01:00',
  status, productId: 11, productName: `상품 ${id}`, optionName: '5kg', thumbnailUrl: null, unitPrice: 10000, quantity: 1, itemAmt: 10000,
  buyerName: '곳*지', receiverName: `수령인${id}`, receiverPhone: '010-1234-5678', zipcode: '06236', address1: '서울 강남구 테헤란로 1', address2: null,
  deliveryMemo: null, courier: null, trackingNo: null, shippedAt: null, deliveredAt: null, confirmedAt: null, ...extra,
});
const LIST = {
  statusCounts: { PAYMENT_DONE: 2, PREPARING: 1, SHIPPING: 0, DELIVERED: 0, CONFIRMED: 0, CANCEL_REQUESTED: 1 },
  items: { content: [row(456, 'PAYMENT_DONE'), row(457, 'PAYMENT_DONE'), row(458, 'PREPARING')], page: 0, size: 20, totalElements: 3, totalPages: 1, hasNext: false },
};
const httpError = (status, message) => Object.assign(new Error(String(status)), { response: { status, data: { code: 'X', message } } });

describe('sellerBulk — 일괄 처리 결과 · 탭', () => {
  it('요약 · 실패 사유 · 탭 ↔ 상태 코드 · 탭 숫자', () => {
    expect(bulkSummary('발주확인', { succeeded: [{}, {}], failed: [] })).toBe('2건 발주확인 완료');
    expect(bulkSummary('발주확인', { succeeded: [{}], failed: [{}] })).toBe('1건 발주확인 완료 · 1건 실패 (표에서 사유 확인)');
    expect(bulkSummary('발주확인', { succeeded: [], failed: [{}] })).toBe('발주확인하지 못했어요 · 1건 실패 (표에서 사유 확인)');
    expect(failureMap({ failed: [{ orderItemId: 457, message: '이미 처리됨' }] })).toEqual({ 457: '이미 처리됨' });
    expect(statusOfTab('배송중')).toBe('SHIPPING');
    expect(statusOfTab('전체')).toBeNull();
    expect(tabCounts(LIST.statusCounts)).toMatchObject({ 전체: 4, 결제완료: 2, 배송준비: 1, 구매확정: 0 });
    expect(tabCounts()).toMatchObject({ 전체: 0, 결제완료: 0 });
  });

  it('송장 요청 — 행마다 택배사(없으면 기본) · 송장번호(비우면 null)', () => {
    expect(toShipItems([{ orderItemId: 1 }, { orderItemId: 2 }], { 1: { courier: '롯데택배', trackingNo: ' 2470-1 ' }, 2: { trackingNo: '  ' } }, 'CJ대한통운'))
      .toEqual([{ orderItemId: 1, courier: '롯데택배', trackingNo: '2470-1' }, { orderItemId: 2, courier: 'CJ대한통운', trackingNo: null }]);
  });
});

describe('판매자 주문 API · 훅', () => {
  it('목록 · 상세 · 발주확인 · 송장 · 배송완료 경로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: 'ok' } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: 'done' } });

    expect(await fetchSellerOrderItems({ status: 'SHIPPING', page: 1 })).toBe('ok');
    expect(await fetchSellerOrderItem(456)).toBe('ok');
    expect(await confirmOrderItems([456])).toBe('done');
    expect(await shipOrderItems([{ orderItemId: 456, courier: 'CJ대한통운', trackingNo: null }])).toBe('done');
    expect(await deliverOrderItems([456])).toBe('done');

    expect(get).toHaveBeenNthCalledWith(1, '/api/seller/order-items', { params: { status: 'SHIPPING', page: 1 } });
    expect(get).toHaveBeenNthCalledWith(2, '/api/seller/order-items/456');
    expect(patch).toHaveBeenNthCalledWith(1, '/api/seller/order-items/confirm', { orderItemIds: [456] });
    expect(patch).toHaveBeenNthCalledWith(2, '/api/seller/order-items/ship', { items: [{ orderItemId: 456, courier: 'CJ대한통운', trackingNo: null }] });
    expect(patch).toHaveBeenNthCalledWith(3, '/api/seller/order-items/deliver', { orderItemIds: [456] });
  });

  it('상세는 ID 없으면 부르지 않고, 처리 뒤 판매자 목록 · 상세 전체 무효화', async () => {
    const { client, Wrapper } = createWrapper();
    expect(renderHook(() => useSellerOrderItemQuery(undefined), { wrapper: Wrapper }).result.current.fetchStatus).toBe('idle');

    vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { succeeded: [], failed: [] } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useConfirmOrderItemsMutation(), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync([456]); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.order.seller() });
  });
});

function renderAt(path, element, routePath) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={routePath} element={element} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SellerOrderList — 서버 페이징 목록 · 일괄 처리', () => {
  it('목록 · 탭 숫자 · 탭 전환은 status 로 다시 조회, 발주확인 일부 실패는 그 행에 사유', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: LIST } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: {
      succeeded: [row(456, 'PREPARING')], failed: [{ orderItemId: 457, code: 'ORDER_INVALID_STATUS', message: '지금 주문 상태에서는 처리할 수 없습니다.' }] } } });
    renderAt('/seller/orders', <SellerOrderList />, '/seller/orders');

    expect(await screen.findByText('상품 456')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/seller/order-items', { params: { status: undefined, q: undefined, page: 0, size: 20 } });
    expect(within(screen.getByRole('button', { name: /^전체/ })).getByText('4')).toBeInTheDocument();

    // 선택이 바뀌면 행이 다시 그려지므로 매번 다시 찾는다 — 456 · 457 · 458(배송준비 — 발주확인 대상 아님)
    [1, 2, 3].forEach((i) => fireEvent.click(screen.getAllByRole('checkbox')[i]));
    fireEvent.click(screen.getByRole('button', { name: '발주확인' }));

    expect(await screen.findByText('처리 실패: 지금 주문 상태에서는 처리할 수 없습니다.')).toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith('/api/seller/order-items/confirm', { orderItemIds: [456, 457] });
    expect(useToastStore.getState().current.msg).toBe('1건 발주확인 완료 · 1건 실패 (표에서 사유 확인)');

    fireEvent.click(screen.getByRole('button', { name: /^배송준비/ }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/seller/order-items', { params: { status: 'PREPARING', q: undefined, page: 0, size: 20 } }));
  });

  it('송장 입력 모달 — 배송준비 행만 택배사 · 송장번호로 발송처리, 배송완료는 배송중 행이 없으면 안내', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: LIST } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { succeeded: [row(458, 'SHIPPING')], failed: [] } } });
    renderAt('/seller/orders', <SellerOrderList />, '/seller/orders');

    await screen.findByText('상품 458');
    fireEvent.click(screen.getAllByRole('checkbox')[3]);
    fireEvent.click(screen.getByRole('button', { name: '배송완료 처리' }));
    expect(useToastStore.getState().current.msg).toBe('배송중 상태의 주문만 배송완료 처리할 수 있어요');

    fireEvent.click(screen.getByRole('button', { name: '송장 입력 · 발송처리' }));
    fireEvent.change(screen.getByPlaceholderText('숫자만 입력 (비우면 자동)'), { target: { value: '651200001234' } });
    fireEvent.click(screen.getByRole('button', { name: '발송처리' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/seller/order-items/ship',
      { items: [{ orderItemId: 458, courier: 'CJ대한통운', trackingNo: '651200001234' }] }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('1건 발송처리 완료'));
  });

  it('처리 요청 자체가 실패하면 서버 메시지 토스트, 목록 조회 실패는 표에 안내', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValueOnce({ data: { data: LIST } }).mockRejectedValue(httpError(500, 'x'));
    vi.spyOn(axiosInstance, 'patch').mockRejectedValue(httpError(403, '스토어 정보가 없습니다.'));
    renderAt('/seller/orders', <SellerOrderList />, '/seller/orders');

    await screen.findByText('상품 456');
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: '발주확인' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('스토어 정보가 없습니다.'));
  });
});

describe('SellerOrderDetail — 상태별 단건 처리', () => {
  it('결제완료 → 발주확인, 실패하면 사유 토스트', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: row(456, 'PAYMENT_DONE') } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { succeeded: [], failed: [{ orderItemId: 456, message: '이미 처리됐어요' }] } } });
    renderAt('/seller/orders/456', <SellerOrderDetail />, '/seller/orders/:lineId');

    fireEvent.click(await screen.findByRole('button', { name: '발주확인' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('이미 처리됐어요'));
    expect(patch).toHaveBeenCalledWith('/api/seller/order-items/confirm', { orderItemIds: [456] });
    expect(screen.getByText('수령인456')).toBeInTheDocument();
    expect(screen.getByText('주문이 접수되었습니다')).toBeInTheDocument();
  });

  it('배송준비 → 송장 입력 폼으로 발송처리, 배송중 → 배송완료 처리', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: row(458, 'PREPARING') } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { succeeded: [{}], failed: [] } } });
    renderAt('/seller/orders/458', <SellerOrderDetail />, '/seller/orders/:lineId');

    fireEvent.click(await screen.findByRole('button', { name: '송장 입력' }));
    fireEvent.click(screen.getByRole('button', { name: '발송처리' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/seller/order-items/ship', { items: [{ orderItemId: 458, courier: 'CJ대한통운', trackingNo: null }] }));
    cleanup();

    get.mockResolvedValue({ data: { data: row(459, 'SHIPPING', { courier: 'CJ대한통운', trackingNo: '651200000459', shippedAt: '2026-10-27T11:00:00' }) } });
    renderAt('/seller/orders/459', <SellerOrderDetail />, '/seller/orders/:lineId');
    fireEvent.click(await screen.findByRole('button', { name: '배송완료 처리' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/seller/order-items/deliver', { orderItemIds: [459] }));
    expect(screen.getByText('상품이 발송되었습니다 (CJ대한통운 651200000459)')).toBeInTheDocument();
  });

  it('없는 상품주문이면 찾을 수 없음, 처리 요청 실패는 서버 메시지', async () => {
    vi.spyOn(axiosInstance, 'get').mockRejectedValueOnce(httpError(404, '없음'));
    renderAt('/seller/orders/1', <SellerOrderDetail />, '/seller/orders/:lineId');
    expect(await screen.findByText('주문을 찾을 수 없어요')).toBeInTheDocument();
    cleanup();

    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: row(456, 'PAYMENT_DONE') } });
    vi.spyOn(axiosInstance, 'patch').mockRejectedValue(httpError(500, undefined));
    renderAt('/seller/orders/456', <SellerOrderDetail />, '/seller/orders/:lineId');
    fireEvent.click(await screen.findByRole('button', { name: '발주확인' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('발주확인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
  });
});
