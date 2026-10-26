import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { useToastStore } from '@/shared/stores/toastStore';
import { fetchClaimPreview, fetchMyOrder, fetchMyOrders, requestClaim } from '@/features/order/api/orderApi';
import { useMyOrderQuery } from '@/features/order/hooks/useMyOrderQuery';
import { useClaimPreviewQuery, useRequestClaimMutation } from '@/features/order/hooks/useClaimMutations';
import {
  claimDoneMessage, claimTypesOf, flowCounts, isSellerFault, lineStatusLabel, openClaimCount, orderNoOf, payMethodLabel, toDate, trackingOf,
} from '@/features/order/utils/orderView';
import MyClaimRequest from '@/features/order/components/MyClaimRequest';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// backend OrderItemResponse · OrderDetailResponse · ClaimPreviewResponse
const ITEM = {
  orderItemId: 456, itemNo: '20261026-000001-01', storeId: 1, storeName: '곳간상회', productId: 11, productOptionId: 111,
  productName: '유기농 사과', optionName: '5kg', thumbnailUrl: 'https://img/a.jpg', unitPrice: 10000, quantity: 2, itemAmt: 20000,
  usedPoint: 1000, earnedPoint: 950, status: 'PAYMENT_DONE', courier: null, trackingNo: null, shippedAt: null, deliveredAt: null, confirmedAt: null,
};
const DETAIL = {
  orderNo: '20261026-000001', status: 'PAID', orderedAt: '2026-10-26T12:00:00', paidAt: '2026-10-26T12:01:00',
  receiverName: '김곳간', receiverPhone: '010-1234-5678', zipcode: '06236', address1: '서울 강남구 테헤란로 152', address2: '21층',
  deliveryMemo: null, totalProductAmt: 20000, totalShippingFee: 3000, usedPoint: 1000, payAmt: 22000, earnedPoint: 950,
  payment: { method: 'CARD', status: 'PAID', cancelledAmount: 0 }, items: [ITEM],
};
const PREVIEW = { orderItemId: 456, type: 'CANCEL', reasonCode: 'CHANGE_OF_MIND', itemAmt: 20000, shippingFee: 3000, sellerFault: false, refundAmt: 22000, restorePoint: 1000, reclaimPoint: 950 };
const httpError = (status, code, message) => Object.assign(new Error(code), { response: { status, data: { code, message } } });

describe('orderView — 응답 → 화면 표시', () => {
  it('결제 대기 · 실패 주문은 주문 상태로, 나머지는 상품주문 상태 라벨', () => {
    expect(lineStatusLabel({ status: 'PENDING' }, { status: 'ORDERED' })).toBe('결제대기');
    expect(lineStatusLabel({ status: 'FAILED' }, { status: 'ORDERED' })).toBe('결제실패');
    expect(lineStatusLabel({ status: 'PAID' }, { status: 'SHIPPING' })).toBe('배송중');
    expect(lineStatusLabel({ status: 'PAID' }, { status: 'NEW_STATUS' })).toBe('NEW_STATUS');
  });

  it('진행 단계 · 진행 중 클레임 개수 — 없는 키는 0', () => {
    expect(flowCounts({ PAYMENT_DONE: 2, SHIPPING: 1 })).toEqual([['결제완료', 2], ['배송준비', 0], ['배송중', 1], ['배송완료', 0], ['구매확정', 0]]);
    expect(flowCounts()).toHaveLength(5);
    expect(openClaimCount({ CANCEL_REQUESTED: 1, RETURN_REQUESTED: 2, CANCELLED: 5 })).toBe(3);
    expect(openClaimCount()).toBe(0);
  });

  it('상품주문번호 → 주문번호, 상태별 신청 가능 클레임, 판매자 귀책 사유', () => {
    expect(orderNoOf('20261026-000001-01')).toBe('20261026-000001');
    expect(claimTypesOf('PAYMENT_DONE')).toEqual(['CANCEL']);
    expect(claimTypesOf('DELIVERED')).toEqual(['RETURN', 'EXCHANGE']);
    expect(claimTypesOf('PREPARING')).toEqual([]);
    expect(isSellerFault('DEFECTIVE')).toBe(true);
    expect(isSellerFault('CHANGE_OF_MIND')).toBe(false);
  });

  it('배송 진행은 최신 단계부터, 결제 전 주문은 접수만', () => {
    const shipped = { ...ITEM, courier: 'CJ대한통운', trackingNo: '651200000456', shippedAt: '2026-10-27T09:00:00', deliveredAt: '2026-10-28T15:00:00' };
    expect(trackingOf(DETAIL, shipped).map((t) => t.what)).toEqual([
      '배송이 완료되었습니다', '상품이 발송되었습니다 (CJ대한통운 651200000456)', '결제가 완료되었습니다', '주문이 접수되었습니다',
    ]);
    expect(trackingOf({ ...DETAIL, paidAt: null }, ITEM)).toHaveLength(1);
    expect(trackingOf(DETAIL, ITEM)[0].at).toEqual(new Date('2026-10-26T12:01:00'));
    expect(toDate(null)).toBeNull();
  });

  it('결제수단 · 클레임 접수 안내', () => {
    expect(payMethodLabel({ method: 'CARD' })).toBe('카드');
    expect(payMethodLabel({ method: 'EASY_PAY' })).toBe('간편결제');
    expect(payMethodLabel({ method: 'VIRTUAL_ACCOUNT' })).toBe('VIRTUAL_ACCOUNT');
    expect(payMethodLabel(null)).toBe('포인트 결제');
    expect(claimDoneMessage({ type: 'CANCEL', status: 'COMPLETED' })).toContain('취소했어요');
    expect(claimDoneMessage({ type: 'CANCEL', status: 'APPROVED' })).toContain('처리하고 있어요');
    expect(claimDoneMessage({ type: 'RETURN', status: 'REQUESTED' })).toContain('반품');
    expect(claimDoneMessage({ type: 'EXCHANGE', status: 'REQUESTED' })).toContain('교환');
  });
});

describe('order API', () => {
  it('내 주문 목록 · 상세 · 환불 예정액 · 클레임 신청 경로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: 'ok' } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: 'done' } });
    const params = { orderItemId: 456, type: 'CANCEL', reasonCode: 'CHANGE_OF_MIND' };

    expect(await fetchMyOrders()).toBe('ok');
    expect(await fetchMyOrder('20261026-000001')).toBe('ok');
    expect(await fetchClaimPreview('20261026-000001', params)).toBe('ok');
    expect(await requestClaim('20261026-000001', { ...params, reasonDetail: null })).toBe('done');

    expect(get).toHaveBeenNthCalledWith(1, '/api/orders');
    expect(get).toHaveBeenNthCalledWith(2, '/api/orders/20261026-000001');
    expect(get).toHaveBeenNthCalledWith(3, '/api/orders/20261026-000001/claims/preview', { params });
    expect(post).toHaveBeenCalledWith('/api/orders/20261026-000001/claims', { ...params, reasonDetail: null });
  });
});

describe('훅', () => {
  it('useMyOrderQuery — 주문번호 없으면 부르지 않음', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMyOrderQuery(''), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useClaimPreviewQuery — 사유를 고르기 전에는 부르지 않음', () => {
    const get = vi.spyOn(axiosInstance, 'get');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimPreviewQuery('20261026-000001', { orderItemId: 456, type: 'CANCEL', reasonCode: '' }), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(get).not.toHaveBeenCalled();
  });

  it('useRequestClaimMutation — 성공하면 내 주문(상세 · 예정액 포함) · 포인트 무효화', async () => {
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { type: 'CANCEL', status: 'COMPLETED' } } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRequestClaimMutation(), { wrapper: Wrapper });

    await act(async () => { await result.current.mutateAsync({ orderNo: '20261026-000001', request: {} }); });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.order.my() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.user.points() });
  });
});

describe('MyClaimRequest — 결제완료 즉시 취소', () => {
  function renderAt(path) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/mypage/claim/:lineId" element={<MyClaimRequest />} />
            <Route path="/mypage/orders" element={<p>주문 목록 화면</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('사유를 고르면 서버 환불 예정액을 보여 주고, 신청하면 POST 후 주문 목록으로', async () => {
    vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url.endsWith('/preview') ? PREVIEW : DETAIL } }));
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { claimId: 1, orderItemId: 456, type: 'CANCEL', status: 'COMPLETED', refundAmt: 22000, restorePoint: 1000 } } });
    renderAt('/mypage/claim/20261026-000001-01?type=CANCEL');

    expect(await screen.findByText('유기농 사과')).toBeInTheDocument();
    expect(screen.getByText('사유를 고르면 환불 예정 금액을 알려 드려요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '단순 변심' }));
    expect(await screen.findByText('22,000원')).toBeInTheDocument();
    expect(screen.getByText('+3,000원')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('판매자에게 전달할 내용을 적어주세요'), { target: { value: ' 다시 주문할게요 ' } });
    fireEvent.click(screen.getByRole('button', { name: '취소 신청하기' }));

    expect(await screen.findByText('주문 목록 화면')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/api/orders/20261026-000001/claims',
      { orderItemId: 456, type: 'CANCEL', reasonCode: 'CHANGE_OF_MIND', reasonDetail: '다시 주문할게요' });
    expect(useToastStore.getState().current.msg).toContain('취소했어요');
  });

  it('신청할 수 없으면(409) 예정액 자리에 서버 메시지, 버튼 잠금', async () => {
    vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
      if (url.endsWith('/preview')) throw httpError(409, 'CLAIM_IN_PROGRESS', '이미 처리 중인 요청이 있습니다.');
      return { data: { data: DETAIL } };
    });
    renderAt('/mypage/claim/20261026-000001-01');

    fireEvent.click(await screen.findByRole('button', { name: '단순 변심' }));
    expect(await screen.findByText('이미 처리 중인 요청이 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소 신청하기' })).toBeDisabled();
  });

  it('결제 대기 · 배송준비 상품주문은 신청 불가 안내, 없는 상품주문은 찾을 수 없음', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { ...DETAIL, items: [{ ...ITEM, status: 'PREPARING' }] } } });
    renderAt('/mypage/claim/20261026-000001-01');
    expect(await screen.findByText('지금은 취소 · 반품 · 교환을 신청할 수 없는 상품이에요.')).toBeInTheDocument();
    cleanup();

    renderAt('/mypage/claim/20261026-000001-09');
    await waitFor(() => expect(screen.getByText('상품주문을 찾을 수 없어요')).toBeInTheDocument());
  });
});
