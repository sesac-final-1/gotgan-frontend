import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { useToastStore } from '@/shared/stores/toastStore';
import { confirmPurchase, withdrawClaim } from '@/features/order/api/orderApi';
import { useConfirmPurchaseMutation, useWithdrawClaimMutation } from '@/features/order/hooks/useClaimMutations';
import { canWithdraw, claimProgress, claimStatusLabel } from '@/features/order/utils/claimView';
import MyOrders from '@/features/order/components/MyOrders';
import MyClaims from '@/features/order/components/MyClaims';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const item = (id, status) => ({
  orderItemId: id, itemNo: `20261027-000001-0${id - 455}`, storeId: 1, storeName: '곳간상회', productId: 11, productOptionId: 111,
  productName: `상품 ${id}`, optionName: '특', thumbnailUrl: null, unitPrice: 10000, quantity: 1, itemAmt: 10000, usedPoint: 0, earnedPoint: 500,
  status, courier: 'CJ대한통운', trackingNo: '651200000001', shippedAt: null, deliveredAt: '2026-10-26T10:00:00', confirmedAt: null,
});
const ORDERS = { statusCounts: { DELIVERED: 1, RETURN_REQUESTED: 1, EXCHANGE_REQUESTED: 1 }, orders: [{
  orderNo: '20261027-000001', status: 'PAID', payAmt: 30000, orderedAt: '2026-10-25T10:00:00',
  items: [item(456, 'DELIVERED'), item(457, 'RETURN_REQUESTED'), item(458, 'EXCHANGE_REQUESTED')],
}] };
const claim = (id, orderItemId, type, status) => ({
  claimId: id, type, status, reasonCode: 'CHANGE_OF_MIND', reasonDetail: null, rejectReason: null, refundAmt: 4000, restorePoint: 0,
  requestedAt: '2026-10-27T09:00:00', processedAt: null, orderItemId, itemNo: 'x', orderNo: '20261027-000001', productName: `상품 ${orderItemId}`,
  optionName: '특', thumbnailUrl: null, quantity: 1, itemAmt: 10000, itemStatus: 'RETURN_REQUESTED', buyerName: null, courier: null, trackingNo: null,
});
const httpError = (status, message) => Object.assign(new Error(String(status)), { response: { status, data: { code: 'X', message } } });
const lastToast = () => useToastStore.getState().current?.msg;

function renderWith(element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
}

describe('구매확정 · 철회 — API · 훅 · 규칙', () => {
  it('경로, 처리 뒤 내 주문(상세 · 클레임 포함) 무효화, 철회는 승인 전 반품 · 교환만', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: 'ok' } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: 'ok' } });
    await confirmPurchase('20261027-000001', 456);
    await withdrawClaim(9);
    expect(post).toHaveBeenCalledWith('/api/orders/20261027-000001/items/456/confirm');
    expect(patch).toHaveBeenCalledWith('/api/claims/9/withdraw');

    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const confirm = renderHook(() => useConfirmPurchaseMutation(), { wrapper: Wrapper }).result;
    const withdraw = renderHook(() => useWithdrawClaimMutation(), { wrapper: Wrapper }).result;
    await act(async () => { await confirm.current.mutateAsync({ orderNo: '20261027-000001', orderItemId: 456 }); });
    await act(async () => { await withdraw.current.mutateAsync(9); });
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.order.my() });

    expect(canWithdraw({ type: 'RETURN', status: 'REQUESTED' })).toBe(true);
    expect(canWithdraw({ type: 'EXCHANGE', status: 'APPROVED' })).toBe(false);
    expect(canWithdraw({ type: 'CANCEL', status: 'REQUESTED' })).toBe(false);
    expect(claimStatusLabel({ type: 'RETURN', status: 'WITHDRAWN' })).toBe('반품철회');
    expect(claimProgress({ type: 'RETURN', status: 'WITHDRAWN' })).toBe('요청을 철회했어요.');
  });
});

describe('MyOrders — 구매확정 · 철회 버튼', () => {
  it('구매확정은 확인 후 POST, 철회는 승인 전 클레임이 있는 상품주문만 버튼 · PATCH, 실패는 서버 메시지', async () => {
    vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url === '/api/claims'
      ? [claim(9, 457, 'RETURN', 'REQUESTED'), claim(10, 458, 'EXCHANGE', 'APPROVED')] : ORDERS } }));
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValueOnce({ data: { data: {} } }).mockRejectedValueOnce(httpError(409, '지금 주문 상태에서는 처리할 수 없습니다.'));
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: {} } });
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    renderWith(<MyOrders />);

    expect(await screen.findByRole('button', { name: '반품철회' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '교환철회' })).toBeNull();   // 승인 뒤라 철회 불가

    fireEvent.click(screen.getByRole('button', { name: '구매확정' }));   // 확인 취소
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '구매확정' }));
    await waitFor(() => expect(lastToast()).toBe('구매확정 되었어요. 리뷰를 작성할 수 있어요'));
    expect(post).toHaveBeenCalledWith('/api/orders/20261027-000001/items/456/confirm');
    fireEvent.click(screen.getByRole('button', { name: '구매확정' }));
    await waitFor(() => expect(lastToast()).toBe('지금 주문 상태에서는 처리할 수 없습니다.'));
    expect(ask).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: '반품철회' }));
    await waitFor(() => expect(lastToast()).toBe('반품 요청을 철회했어요'));
    expect(patch).toHaveBeenCalledWith('/api/claims/9/withdraw');
  });
});

describe('MyClaims — 상세에서 철회', () => {
  it('승인 전 요청만 철회 버튼, 성공하면 토스트 · 닫힘, 실패는 서버 메시지', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [claim(9, 457, 'RETURN', 'REQUESTED'), claim(10, 458, 'EXCHANGE', 'APPROVED')] } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockRejectedValueOnce(httpError(409, '지금 요청 상태에서는 처리할 수 없습니다.'))
      .mockResolvedValue({ data: { data: {} } });
    renderWith(<MyClaims />);

    const details = await screen.findAllByRole('button', { name: '상세' });
    fireEvent.click(details[1]);   // 교환 승인됨 — 철회 없음
    expect(screen.queryByRole('button', { name: '요청 철회' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '닫기' }).at(-1));   // 모달 하단 닫기 (X 버튼도 '닫기')

    fireEvent.click(screen.getAllByRole('button', { name: '상세' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '요청 철회' }));
    await waitFor(() => expect(lastToast()).toBe('지금 요청 상태에서는 처리할 수 없습니다.'));
    fireEvent.click(screen.getByRole('button', { name: '요청 철회' }));
    await waitFor(() => expect(lastToast()).toBe('반품 요청을 철회했어요'));
    expect(patch).toHaveBeenLastCalledWith('/api/claims/9/withdraw');
    await waitFor(() => expect(screen.queryByRole('button', { name: '요청 철회' })).toBeNull());
  });
});
