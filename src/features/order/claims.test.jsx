import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { useToastStore } from '@/shared/stores/toastStore';
import { approveClaim, collectClaim, fetchMyClaims, fetchSellerClaims, rejectClaim, reshipClaim } from '@/features/order/api/orderApi';
import { useApproveClaimMutation } from '@/features/order/hooks/useClaimsQuery';
import { claimProgress, claimStatusLabel, nextAction, reasonLabel } from '@/features/order/utils/claimView';
import SellerClaimList from '@/features/order/components/SellerClaimList';
import MyClaims from '@/features/order/components/MyClaims';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// backend ClaimDetailResponse
const claim = (id, type, status, extra = {}) => ({
  claimId: id, type, status, reasonCode: 'DEFECTIVE', reasonDetail: '흠집', rejectReason: null, refundAmt: 18000, restorePoint: 2000,
  requestedAt: '2026-10-27T10:00:00', processedAt: null, orderItemId: 400 + id, itemNo: `20261027-00000${id}-01`, orderNo: `20261027-00000${id}`,
  productName: `상품 ${id}`, optionName: '특', thumbnailUrl: null, quantity: 1, itemAmt: 20000, itemStatus: 'RETURN_REQUESTED',
  buyerName: '곳*지', courier: null, trackingNo: null, ...extra,
});
const PAGE = (content) => ({ stageCounts: { OPEN: 3, DONE: 1 }, typeCounts: { CANCEL: 0, RETURN: 2, EXCHANGE: 1 },
  items: { content, page: 0, size: 20, totalElements: content.length, totalPages: 1, hasNext: false } });
const httpError = (status, message) => Object.assign(new Error(String(status)), { response: { status, data: { code: 'X', message } } });

describe('claimView — 상태 · 다음 처리 · 안내', () => {
  it('상태 배지 · 사유 라벨', () => {
    expect(claimStatusLabel({ type: 'RETURN', status: 'REQUESTED' })).toBe('반품요청');
    expect(claimStatusLabel({ type: 'EXCHANGE', status: 'RESHIPPED' })).toBe('교환재배송중');
    expect(claimStatusLabel({ type: 'CANCEL', status: 'APPROVED' })).toBe('취소중');
    expect(claimStatusLabel({ type: 'NEW', status: 'NEW' })).toBe('NEWNEW');
    expect(reasonLabel('ETC')).toBe('기타');
    expect(reasonLabel('DEFECTIVE')).toBe('상품 불량 · 파손');
    expect(reasonLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('다음 처리 — 요청: 승인 · 거부, 승인: 수거, 교환 수거완료: 재배송, 그 밖 · 취소는 없음', () => {
    expect(nextAction({ type: 'RETURN', status: 'REQUESTED' })).toMatchObject({ action: 'approve', rejectable: true });
    expect(nextAction({ type: 'RETURN', status: 'APPROVED' })).toMatchObject({ action: 'collect', label: '수거 완료 · 환불' });
    expect(nextAction({ type: 'EXCHANGE', status: 'APPROVED' }).label).toBe('수거 완료');
    expect(nextAction({ type: 'EXCHANGE', status: 'COLLECTED' }).action).toBe('reship');
    expect(nextAction({ type: 'RETURN', status: 'COLLECTED' })).toBeNull();
    expect(nextAction({ type: 'CANCEL', status: 'REQUESTED' })).toBeNull();
  });

  it('진행 안내', () => {
    expect(claimProgress({ type: 'RETURN', status: 'REQUESTED' })).toContain('판매자 확인');
    expect(claimProgress({ type: 'CANCEL', status: 'APPROVED' })).toContain('환불');
    expect(claimProgress({ type: 'EXCHANGE', status: 'APPROVED' })).toContain('회수');
    expect(claimProgress({ type: 'RETURN', status: 'COLLECTED' })).toContain('환불');
    expect(claimProgress({ type: 'EXCHANGE', status: 'COLLECTED' })).toContain('다시 보내');
    expect(claimProgress({ type: 'EXCHANGE', status: 'RESHIPPED' })).toContain('배송완료');
    expect(claimProgress({ type: 'RETURN', status: 'REJECTED', rejectReason: '사용 흔적' })).toBe('판매자가 거부했어요 — 사용 흔적');
    expect(claimProgress({ type: 'RETURN', status: 'COMPLETED' })).toBe('반품 처리가 끝났어요.');
  });
});

describe('클레임 API · 훅', () => {
  it('경로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: 'ok' } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: 'done' } });

    await fetchMyClaims();
    await fetchSellerClaims({ stage: 'OPEN' });
    await approveClaim(1); await rejectClaim(1, '사유'); await collectClaim(1); await reshipClaim(1, { courier: 'CJ대한통운', trackingNo: null });

    expect(get).toHaveBeenNthCalledWith(1, '/api/claims');
    expect(get).toHaveBeenNthCalledWith(2, '/api/seller/claims', { params: { stage: 'OPEN' } });
    expect(patch.mock.calls).toEqual([
      ['/api/seller/claims/1/approve'], ['/api/seller/claims/1/reject', { reason: '사유' }], ['/api/seller/claims/1/collect'],
      ['/api/seller/claims/1/reship', { courier: 'CJ대한통운', trackingNo: null }],
    ]);
  });

  it('처리 뒤 판매자 클레임 · 주문 전체 무효화', async () => {
    vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: claim(1, 'RETURN', 'APPROVED') } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useApproveClaimMutation(), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync(1); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.order.seller() });
  });
});

function renderWith(element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>);
}
const lastToast = () => useToastStore.getState().current?.msg;

describe('SellerClaimList — 서버 목록 · 단계별 처리', () => {
  it('탭 숫자 · 단계 전환 조회, 요청 승인 · 반품 수거 완료(환불) · 교환 재배송 송장', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: PAGE([
      claim(1, 'RETURN', 'REQUESTED'), claim(2, 'RETURN', 'APPROVED'), claim(3, 'EXCHANGE', 'COLLECTED', { itemStatus: 'EXCHANGE_REQUESTED' }),
    ]) } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockImplementation(async (url) => ({ data: { data: url.endsWith('/collect')
      ? claim(2, 'RETURN', 'COMPLETED') : claim(1, 'RETURN', 'APPROVED') } }));
    renderWith(<SellerClaimList />);

    expect(await screen.findByText('상품 1')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/seller/claims', { params: { stage: 'OPEN', type: undefined, page: 0, size: 20 } });
    expect(screen.getByRole('button', { name: /^전체/ })).toHaveTextContent('3');

    fireEvent.click(screen.getByRole('button', { name: '승인 (수거 요청)' }));
    await waitFor(() => expect(lastToast()).toBe('승인했어요. 상품을 회수해 주세요'));
    fireEvent.click(screen.getByRole('button', { name: '수거 완료 · 환불' }));
    await waitFor(() => expect(lastToast()).toBe('반품 완료 — 18,000원 환불했어요'));

    fireEvent.click(screen.getByRole('button', { name: '재배송 송장' }));
    fireEvent.change(screen.getByPlaceholderText('숫자만 입력 (비우면 자동)'), { target: { value: ' 651200000777 ' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/seller/claims/3/reship', { courier: 'CJ대한통운', trackingNo: '651200000777' }));
    expect(patch).toHaveBeenCalledWith('/api/seller/claims/1/approve');
    expect(patch).toHaveBeenCalledWith('/api/seller/claims/2/collect');

    fireEvent.click(screen.getByRole('button', { name: /^처리완료/ }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/seller/claims', { params: { stage: 'DONE', type: undefined, page: 0, size: 20 } }));
    fireEvent.click(screen.getByRole('button', { name: /^교환/ }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/seller/claims', { params: { stage: 'DONE', type: 'EXCHANGE', page: 0, size: 20 } }));
  });

  it('거부 — 사유(선택 + 상세)로 요청, 상세 모달에서 승인 · 거부, 처리 실패는 서버 메시지', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: PAGE([claim(1, 'RETURN', 'REQUESTED')]) } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: claim(1, 'RETURN', 'REJECTED') } });
    renderWith(<SellerClaimList />);

    fireEvent.click(await screen.findByRole('button', { name: '거부' }));
    fireEvent.change(screen.getByPlaceholderText('구매자에게 전달할 상세 사유'), { target: { value: '라벨 제거됨' } });
    fireEvent.click(screen.getByRole('button', { name: '거부하기' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/seller/claims/1/reject', { reason: '상품 사용 흔적 확인 — 라벨 제거됨' }));
    expect(lastToast()).toBe('거부 사유가 구매자에게 전달되었어요');

    fireEvent.click(screen.getByRole('button', { name: '상세' }));
    expect(screen.getByText('반품 요청 상세')).toBeInTheDocument();
    expect(screen.getByText('18,000원')).toBeInTheDocument();
    patch.mockRejectedValueOnce(httpError(409, '지금 요청 상태에서는 처리할 수 없습니다.'));
    fireEvent.click(screen.getAllByRole('button', { name: '승인 (수거 요청)' }).at(-1));
    await waitFor(() => expect(lastToast()).toBe('지금 요청 상태에서는 처리할 수 없습니다.'));
  });
});

describe('MyClaims — 내 클레임 내역', () => {
  it('유형 탭 숫자 · 상태 배지 · 상세에 진행 안내 · 거부 사유 · 재배송 송장', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [
      claim(1, 'RETURN', 'REJECTED', { rejectReason: '기간 지남' }),
      claim(2, 'EXCHANGE', 'RESHIPPED', { courier: 'CJ대한통운', trackingNo: '651200000402', refundAmt: 0, restorePoint: 0 }),
      claim(3, 'CANCEL', 'COMPLETED', { reasonCode: 'CHANGE_OF_MIND' }),
    ] } });
    renderWith(<MyClaims />);

    expect(await screen.findByText('반품거부')).toBeInTheDocument();
    expect(screen.getByText('교환재배송중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^전체/ })).toHaveTextContent('3');

    fireEvent.click(screen.getAllByRole('button', { name: '상세' })[0]);
    expect(screen.getByText('판매자가 거부했어요 — 기간 지남')).toBeInTheDocument();
    cleanup();

    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [
      claim(2, 'EXCHANGE', 'RESHIPPED', { courier: 'CJ대한통운', trackingNo: '651200000402' }), claim(3, 'CANCEL', 'COMPLETED'),
    ] } });
    renderWith(<MyClaims />);
    fireEvent.click((await screen.findAllByRole('button', { name: '상세' }))[0]);
    expect(screen.getByText('CJ대한통운 651200000402')).toBeInTheDocument();
  });
});
