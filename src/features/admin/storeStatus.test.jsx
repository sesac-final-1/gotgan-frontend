import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useToastStore } from '@/shared/stores/toastStore';
import { axiosInstance } from '@/shared/api/axiosInstance';
import StoreDetail from '@/features/admin/components/StoreDetail';
import { productStatusLabel } from '@/features/admin/constants';
import ReportModeration from '@/features/admin/components/ReportModeration';

// 스토어 정지 · 해제 (backend #177 — store 9절 그대로) · 신고 상세의 리뷰 사진 (review #164)
let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
});

const store = (status) => ({ storeId: 1, storeName: '산골농부 박씨네', slug: 'park-farm', userId: 2, ownerName: '박영철', bizRegNo: '000-00-00006',
  grade: 'BIG_POWER', status, statusReason: null, createdAt: '2024-03-01T10:00:00+09:00' });

// 상세(1절 확장, backend #182) — 목록 항목 + 관리자 필드 · 상태 이력
const detail = (status) => ({ storeId: 1, userId: 2, storeName: '산골농부 박씨네', status, shippingFee: 3000, freeShippingThreshold: 30000, courier: '우체국택배',
  slug: 'park-farm', ownerName: '박영철', companyName: '산골농부 박씨네', bizRegNo: '000-00-00006', csPhone: '064-0000-0006', grade: 'BIG_POWER',
  dispatchNote: '수확일 기준 당일 발송', statusReason: status === 'SUSPENDED' ? '반품 미처리' : null, applicationId: 1, createdAt: '2024-03-01T10:00:00+09:00',
  statusHistory: [{ fromStatus: null, toStatus: 'ACTIVE', actor: 'ADMIN', reason: null, changedAt: '2024-03-01T10:00:00+09:00' },
    ...(status === 'ACTIVE' ? [] : [{ fromStatus: 'ACTIVE', toStatus: status, actor: status === 'CLOSED' ? 'SELLER' : 'ADMIN', reason: status === 'CLOSED' ? null : '반품 미처리', changedAt: '2026-10-20T10:00:00+09:00' }])] });

/** URL 별 응답 — 나머지(평점 · 카테고리 등)는 빈 배열 */
function stubGet(routes) {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: routes[url] ?? [] } }));
}

function renderAt(path) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/stores/:id" element={<StoreDetail />} />
          <Route path="/admin/reports" element={<ReportModeration />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('관리자 스토어 정지 · 해제', () => {
  it('정지 — 사유를 써야 변경 가능, PATCH 본문 {status, reason}, 끝나면 스토어 목록을 다시 불러온다', async () => {
    stubGet({ '/api/admin/stores': [store('ACTIVE')], '/api/admin/stores/1': detail('ACTIVE') });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { storeId: 1, status: 'SUSPENDED' } } });
    renderAt('/admin/stores/1');

    fireEvent.click(await screen.findByRole('button', { name: '상태 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '정지' }));
    expect(screen.getByRole('button', { name: '변경' })).toBeDisabled(); // 사유 없음
    fireEvent.change(screen.getByLabelText('사유 (스토어 이력에 기록)'), { target: { value: '  허위 광고 신고 3건  ' } });
    const listCalls = axiosInstance.get.mock.calls.filter(([url]) => url === '/api/admin/stores').length;
    fireEvent.click(screen.getByRole('button', { name: '변경' }));

    await waitFor(() => expect(useToastStore.getState().current.msg).toContain('스토어를 정지했어요'));
    expect(patch).toHaveBeenCalledWith('/api/admin/stores/1/status', { status: 'SUSPENDED', reason: '허위 광고 신고 3건' });
    await waitFor(() => expect(axiosInstance.get.mock.calls.filter(([url]) => url === '/api/admin/stores').length).toBeGreaterThan(listCalls));
  });

  it('실패하면 서버 메시지를 그대로 안내, 폐점 스토어는 상태 변경 버튼이 없다', async () => {
    stubGet({ '/api/admin/stores': [store('SUSPENDED')], '/api/admin/stores/1': detail('SUSPENDED') });
    vi.spyOn(axiosInstance, 'patch').mockRejectedValue({ response: { data: { message: '폐점한 스토어는 상태를 바꿀 수 없습니다.' } } });
    renderAt('/admin/stores/1');

    fireEvent.click(await screen.findByRole('button', { name: '상태 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '운영중' }));
    fireEvent.change(screen.getByLabelText('사유 (스토어 이력에 기록)'), { target: { value: '소명 완료' } });
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('폐점한 스토어는 상태를 바꿀 수 없습니다.'));
    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/admin/stores/1/status', { status: 'ACTIVE', reason: '소명 완료' });

    cleanup();
    stubGet({ '/api/admin/stores': [store('CLOSED')], '/api/admin/stores/1': detail('CLOSED') });
    renderAt('/admin/stores/1');
    expect(await screen.findByRole('button', { name: '판매자와 상담' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '상태 변경' })).not.toBeInTheDocument();
  });
});

describe('관리자 스토어 상세 — 등록 상품 · 강제 판매중지 (backend #110 · #112)', () => {
  const PRODUCTS = [
    { productId: 101, name: '서귀포 노지 햇감귤 5kg', topCategoryName: '식품', categoryName: '과일', salePrice: 26980, totalStock: 900, soldOut: false,
      status: 'ON_SALE', statusReason: null, imageUrl: 'https://img.example/p101.jpg' },
    { productId: 102, name: '한라봉 3kg', topCategoryName: '식품', categoryName: '과일', salePrice: 32000, totalStock: 0, soldOut: true,
      status: 'BLOCKED', statusReason: '원산지 표기 누락', imageUrl: null },
  ];

  it('실제 상품 목록 · 상태(강제중지 사유) · 판매중 수, 강제중지는 사유를 써야 · PATCH 본문 {blocked, reason}', async () => {
    stubGet({ '/api/admin/stores': [store('ACTIVE')], '/api/admin/stores/1': detail('ACTIVE'), '/api/admin/stores/1/products': PRODUCTS });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { productId: 101, status: 'BLOCKED' } } });
    renderAt('/admin/stores/1');

    expect(await screen.findByText('서귀포 노지 햇감귤 5kg')).toBeInTheDocument();
    expect(screen.getByText('원산지 표기 누락')).toBeInTheDocument();
    expect(screen.getByText('강제중지', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('등록 2개 · 삭제 제외')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '강제중지' }));
    expect(screen.getByRole('button', { name: '판매중지' })).toBeDisabled(); // 사유 없음
    fireEvent.change(screen.getByLabelText('사유 (판매자 상품 목록에 표시)'), { target: { value: ' 허위 광고 ' } });
    fireEvent.click(screen.getByRole('button', { name: '판매중지' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toContain('강제 판매중지했어요'));
    expect(patch).toHaveBeenCalledWith('/api/admin/products/101/block', { blocked: true, reason: '허위 광고' });
  });

  it('상태 라벨 — 강제중지 · 판매중지 · 재고 0 이면 품절 · 그 밖은 판매중', () => {
    expect(productStatusLabel({ status: 'BLOCKED', soldOut: true })).toBe('강제중지');
    expect(productStatusLabel({ status: 'STOPPED', soldOut: false })).toBe('판매중지');
    expect(productStatusLabel({ status: 'ON_SALE', soldOut: true })).toBe('품절');
    expect(productStatusLabel({ status: 'ON_SALE', soldOut: false })).toBe('판매중');
  });

  it('실패하면 서버 메시지 그대로 · 모달은 닫히지 않고, 취소하면 사유를 비운다', async () => {
    stubGet({ '/api/admin/stores': [store('ACTIVE')], '/api/admin/stores/1': detail('ACTIVE'), '/api/admin/stores/1/products': PRODUCTS });
    vi.spyOn(axiosInstance, 'patch').mockRejectedValue({ response: { data: { message: '사유를 입력해 주세요.' } } });
    renderAt('/admin/stores/1');

    fireEvent.click(await screen.findByRole('button', { name: '강제중지' }));
    fireEvent.change(screen.getByLabelText('사유 (판매자 상품 목록에 표시)'), { target: { value: '허위 광고' } });
    fireEvent.click(screen.getByRole('button', { name: '판매중지' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('사유를 입력해 주세요.'));
    fireEvent.click(screen.getAllByRole('button', { name: '취소' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '강제중지' }));
    expect(screen.getByLabelText('사유 (판매자 상품 목록에 표시)')).toHaveValue('');
  });

  it('강제중지 상품은 해제 — 사유 없이 {blocked: false, reason: null}', async () => {
    stubGet({ '/api/admin/stores': [store('ACTIVE')], '/api/admin/stores/1': detail('ACTIVE'), '/api/admin/stores/1/products': PRODUCTS });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { productId: 102, status: 'STOPPED' } } });
    renderAt('/admin/stores/1');

    fireEvent.click(await screen.findByRole('button', { name: '해제' }));
    fireEvent.click(screen.getAllByRole('button', { name: '해제' }).at(-1));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/products/102/block', { blocked: false, reason: null }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toContain('강제 판매중지를 풀었어요'));
  });
});

describe('관리자 스토어 상세 — 최근 8주 정산 (backend #184)', () => {
  it('정산 이력 표 · 8주 거래액 · 수수료 KPI 를 스토어 최근 정산서 API 로, 지급 전이면 지급 예정일', async () => {
    const summary = (id, week, weekStart, weekEnd, salesAmt, status, paidAt) => ({ id, storeId: 1, storeName: '산골농부 박씨네', week, weekStart, weekEnd,
      itemCount: 2, carriedOverCount: 0, salesAmt, commissionAmt: salesAmt * 0.07, paymentFeeAmt: 0, payoutAmt: salesAmt * 0.9, status,
      holdReason: null, scheduledPayDate: '2026-10-29', paidAt });
    stubGet({
      '/api/admin/stores': [store('ACTIVE')], '/api/admin/stores/1': detail('ACTIVE'),
      '/api/admin/stores/1/settlements': { storeId: 1, weeks: 8, fromWeek: '2026-W37', totals: { count: 2, salesAmt: 1_200_000, commissionAmt: 84_000 },
        settlements: [summary(11, '2026-W43', '2026-10-19', '2026-10-25', 700_000, 'SCHEDULED', null),
          summary(10, '2026-W42', '2026-10-12', '2026-10-18', 500_000, 'PAID', '2026-10-22T10:00:00+09:00')] },
    });
    renderAt('/admin/stores/1');

    expect(await screen.findByText('정산서 2건 · 이번 주 포함')).toBeInTheDocument();
    expect(screen.getByText('700,000')).toBeInTheDocument();
    expect(screen.getByText('2026.10.29')).toBeInTheDocument();   // 지급 전 — 예정일
    expect(screen.getByText('2026.10.22')).toBeInTheDocument();   // 지급 완료 — 지급 시각
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/admin/stores/1/settlements', { params: { weeks: 8 } });
  });
});

describe('관리자 스토어 상세 — 기본 정보 · 상태 이력 (backend #182)', () => {
  it('상호 · 사업자번호 · 고객 문의 · 배송(무료 기준) · 출고 안내 · 신청서 링크, 상태 이력은 최신 먼저 · 처리자 · 사유', async () => {
    stubGet({ '/api/admin/stores': [store('SUSPENDED')], '/api/admin/stores/1': detail('SUSPENDED') });
    renderAt('/admin/stores/1');

    expect(await screen.findByText('064-0000-0006')).toBeInTheDocument();
    expect(screen.getByText('우체국택배 · 3,000원 · 30,000원 이상 무료')).toBeInTheDocument();
    expect(screen.getByText('수확일 기준 당일 발송')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '신청서 #1' })).toHaveAttribute('href', '/admin/applications/1');
    expect(screen.getByText('운영중 → 정지')).toBeInTheDocument();
    expect(screen.getByText('개설 (운영중)')).toBeInTheDocument();
    expect(screen.getAllByText('반품 미처리').length).toBeGreaterThanOrEqual(2); // 상태 사유 · 이력 사유
  });

  it('무료배송 기준 · 택배사 · 출고 안내가 없으면 대체 문구, 없는 스토어는 찾을 수 없어요', async () => {
    stubGet({ '/api/admin/stores': [], '/api/admin/stores/1': { ...detail('CLOSED'), freeShippingThreshold: null, courier: null, dispatchNote: null, csPhone: null } });
    renderAt('/admin/stores/1');
    expect(await screen.findByText('택배사 미지정 · 3,000원 · 무료배송 없음')).toBeInTheDocument();
    expect(screen.getByText('운영중 → 폐점')).toBeInTheDocument();
    cleanup();

    vi.restoreAllMocks();
    vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
      if (url === '/api/admin/stores/999') throw Object.assign(new Error('404'), { response: { status: 404 } });
      return { data: { data: [] } };
    });
    renderAt('/admin/stores/999');
    expect(await screen.findByText('스토어를 찾을 수 없어요')).toBeInTheDocument();
  });
});

describe('신고 상세 — 리뷰 사진', () => {
  it('리뷰에 사진이 있으면 썸네일로 보여 주고 원본은 새 탭으로', async () => {
    stubGet({
      '/api/admin/reports': [{ targetType: 'REVIEW', targetId: 31, summary: '별로예요', reasonCounts: { ABUSE: 1 }, openCount: 1, totalCount: 1,
        lastReportedAt: '2026-10-29T10:00:00+09:00', lastAction: null }],
      '/api/admin/reports/REVIEW/31': { targetType: 'REVIEW', targetId: 31, actions: [],
        target: { reviewId: 31, content: '별로예요', rating: 1, productId: 101, blinded: false, imageUrls: ['https://img.example/r31-1.jpg'] },
        reports: [{ reportId: 1, status: 'OPEN', reasonCode: 'ABUSE', detail: null, reporterRole: 'BUYER', reporterId: 4, createdAt: '2026-10-29T10:00:00+09:00' }] },
    });
    renderAt('/admin/reports');

    fireEvent.click(await screen.findByRole('button', { name: '처리' }));
    const photo = await screen.findByRole('img', { name: '리뷰 사진' });
    expect(photo).toHaveAttribute('src', 'https://img.example/r31-1.jpg');
    expect(photo.closest('a')).toHaveAttribute('target', '_blank');
  });
});
