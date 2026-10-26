import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useAdminDashboardQuery } from '@/features/admin/hooks/useAdminDashboardQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminReportsQuery } from '@/features/admin/hooks/useAdminReportsQuery';
import { useAdminReportQuery } from '@/features/admin/hooks/useAdminReportQuery';
import { useResolveReportMutation } from '@/features/admin/hooks/useResolveReportMutation';
import { useCreateReportMutation } from '@/features/report/hooks/useCreateReportMutation';
import { useAdminSettlementWeekQuery } from '@/features/admin/hooks/useAdminSettlementWeekQuery';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminUserPointsQuery } from '@/features/admin/hooks/useAdminUserPointsQuery';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { useApplicationQuery } from '@/features/admin/hooks/useApplicationQuery';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useDecideApplicationMutation } from '@/features/admin/hooks/useDecideApplicationMutation';
import { usePaySettlementsMutation, useHoldSettlementsMutation, useReleaseSettlementHoldMutation, useAggregateSettlementsMutation } from '@/features/admin/hooks/useSettlementMutations';
import { isoWeek, recentWeeks } from '@/features/admin/constants';
import { useSaveCategoryMutation, useReserveCommissionMutation } from '@/features/admin/hooks/useCategoryMutations';
import { useMyOrdersMockQuery, useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useSellerBuyersQuery } from '@/features/order/hooks/useSellerBuyersQuery';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useQnasQuery } from '@/features/review/hooks/useQnasQuery';
import { useReviewsQuery } from '@/features/review/hooks/useReviewsQuery';
import { useSellerPendingQuery } from '@/features/settlement/hooks/useSellerPendingQuery';
import { useSellerSettlementsQuery } from '@/features/settlement/hooks/useSellerSettlementsQuery';
import { useSellerSettlementQuery } from '@/features/settlement/hooks/useSellerSettlementQuery';
import { useAdminSettlementQuery } from '@/features/admin/hooks/useAdminSettlementQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useSellerDailySalesQuery } from '@/features/store/hooks/useSellerDailySalesQuery';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import { useMyPointsQuery } from '@/features/user/hooks/useMyPointsQuery';

// 조회 훅 — 목업 api 를 거쳐 데이터가 도착하는지 (API 교체 후에도 같은 테스트로 MSW 응답 확인 가능)
const LIST_HOOKS = {
  useAdminProductsQuery, useAdminReviewsQuery, useAdminSettlementsQuery, useAdminStoresQuery,
  useMyOrdersMockQuery, useSellerBuyersQuery,
  useSellerOrderItemsQuery, useCategoriesQuery, useProductsQuery, useQnasQuery, useReviewsQuery,
  useSellerDailySalesQuery, useStoresQuery,
};
const OBJECT_HOOKS = { useMyStoreQuery };
// 실제 API 로 바꾼 훅 — 응답을 흉내 내 화면 필드로 오는지 (변환 세부는 features/user/userApi.test.js)
const API_HOOKS = {
  useApplicationsQuery: [[{ applicationId: 27, applicationNo: 'AP-2610-027', storeName: '곳간상회', ownerName: '홍길동', bizType: 'INDIVIDUAL',
    categoryId: 1, categoryName: '식품', expectedMonthlySales: 'FROM_5M_TO_20M', status: 'PENDING', submittedAt: '2026-10-22T14:05:11+09:00' }],
  [{ id: '27', no: 'AP-2610-027', owner: '홍길동', catName: '식품', bizType: '개인', expected: '월 500만 ~ 2,000만원', status: '심사대기' }]],
  useAdminDashboardQuery: [{ settlement: null, order: { totalTradeAmt: 662000, orderCount: 14 }, unavailable: ['settlement'] },
    { settlement: null, order: { orderCount: 14 }, unavailable: ['settlement'] }],
  useAdminUsersQuery: [{ content: [{ userId: 4, name: '구매자1', status: 'SUSPENDED', totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' }], hasNext: false },
    [{ id: '4', name: '구매자1', status: '이용정지' }]],
  useMeQuery: [{ userId: 4, name: '구매자1', grade: 'NORMAL', point: 0, totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' }, { id: 4 }],
  useMyPointsQuery: [{ balance: 0, history: [] }, { balance: 0, history: [] }],
  useMyAddressesQuery: [[{ id: 10, label: '집', main: true }], [{ id: 10, label: '집', main: true }]],
  useMyOrdersQuery: [{ statusCounts: { PAYMENT_DONE: 1 }, orders: [{ orderNo: '20261026-000001', status: 'PAID', items: [] }] },
    { statusCounts: { PAYMENT_DONE: 1 }, orders: [{ orderNo: '20261026-000001' }] }],
};
const API_HOOK_FNS = { useApplicationsQuery, useAdminDashboardQuery, useMeQuery, useMyPointsQuery, useMyAddressesQuery, useAdminUsersQuery, useMyOrdersQuery };

async function load(hook, ...args) {
  const { Wrapper } = createWrapper();
  const { result } = renderHook(() => hook(...args), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data;
}

describe('조회 훅', () => {
  it.each(Object.entries(LIST_HOOKS))('%s → 비어 있지 않은 배열', async (_, hook) => {
    const data = await load(hook);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(OBJECT_HOOKS))('%s → 객체', async (_, hook) => {
    expect(await load(hook)).toBeTypeOf('object');
  });

  it.each(Object.entries(API_HOOKS))('%s → API 응답을 화면 필드로', async (name, [response, expected]) => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: response } });
    try {
      expect(await load(API_HOOK_FNS[name])).toMatchObject(expected);
    } finally {
      get.mockRestore();
    }
  });

  it('관리자 카테고리 — 카테고리 트리 + 수수료를 합쳐 목업 모양(문자열 id · 비율 · 하위 이름)으로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url === '/api/admin/categories'
      ? [{ id: 3, name: '패션의류', nameEn: 'Apparel', sortOrder: 1, active: true, children: [{ id: 301, name: '셔츠', nameEn: null, sortOrder: 1, active: true }] },
        { id: 604, name: '반려동물', nameEn: null, sortOrder: 7, active: false, children: [] }]
      : [{ categoryId: 3, current: { rate: 11.5, effectiveFrom: '2026-01-01' }, reserved: [] }] } }));
    try {
      expect(await load(useAdminCategoriesQuery)).toMatchObject([
        { id: 'fashion', categoryId: 3, name: '패션의류', en: 'Apparel', commission: 0.115, subs: ['셔츠'], active: true },
        { id: '604', categoryId: 604, commission: null, subs: [], active: false },
      ]);
    } finally {
      get.mockRestore();
    }
  });

  it('회원 포인트 — userId 가 있을 때만 조회', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { balance: 100, history: { content: [
      { id: 1, type: 'EARN', amount: 100, balanceAfter: 100, orderNo: '20261026-000001', createdAt: '2026-10-26T10:00:00+09:00' }] } } } });
    expect(await load(useAdminUserPointsQuery, '4')).toMatchObject([{ id: '1', type: '적립', amount: 100 }]);
    expect(get).toHaveBeenCalledWith('/api/admin/users/4/points', { params: { size: 100 } });
    get.mockRestore();

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAdminUserPointsQuery(undefined), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('목업 응답은 매번 새 객체 (같은 참조면 변경 후 화면이 갱신되지 않음)', async () => {
    const a = await load(useStoresQuery);
    const b = await load(useStoresQuery);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe('입점 심사 (store 계약 — 상세 · 승인 · 반려 · 보완요청)', () => {
  it('상세 → 소개 HTML 은 글자만 · 서류 라벨 · 이력 처리자 · 같은 사업자번호', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: {
      applicationId: 27, applicationNo: 'AP-2610-027', status: 'SUPPLEMENT', statusReason: '사본이 흐립니다', categoryId: 1, categoryName: '식품',
      bizType: 'CORPORATE', intro: '<p>리넨 <b>의류</b><img src=x onerror="alert(1)"></p>', settlementAccount: { bank: '국민', number: '0', holder: '홍길동' },
      documents: [{ documentId: 101, docType: 'ECOMMERCE_REG', current: true, url: 'https://s3/doc' }],
      history: [{ fromStatus: 'PENDING', toStatus: 'SUPPLEMENT', actor: 'ADMIN', reason: '사본이 흐립니다', changedAt: '2026-10-23T10:00:00+09:00' }],
      sameBizRegNo: { applications: [{ applicationId: 9 }], stores: [] },
    } } });
    try {
      expect(await load(useApplicationQuery, '27')).toMatchObject({
        id: '27', status: '보완요청', note: '사본이 흐립니다', bizType: '법인', intro: '리넨 의류',
        documents: [{ documentId: 101, label: '통신판매업 신고증' }],
        history: [{ from: '심사대기', to: '보완요청', by: '곳간 운영팀', reason: '사본이 흐립니다' }],
        sameBizRegNo: { applications: [{ applicationId: 9 }], stores: [] },
      });
      expect(get).toHaveBeenCalledWith('/api/admin/applications/27');
    } finally {
      get.mockRestore();
    }
  });

  it('승인 · 반려 · 보완요청은 PATCH /{id}/{action} — 끝나면 목록 · 상세 다시 불러오기', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { applicationId: 27 } } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    try {
      const { result } = renderHook(() => useDecideApplicationMutation(), { wrapper: Wrapper });
      await act(() => result.current.mutateAsync({ id: '27', action: 'approve' }));
      expect(patch).toHaveBeenCalledWith('/api/admin/applications/27/approve', undefined);
      await act(() => result.current.mutateAsync({ id: '27', action: 'supplement', body: { message: '사본 재제출', requestedDocs: ['ECOMMERCE_REG'] } }));
      expect(patch).toHaveBeenCalledWith('/api/admin/applications/27/supplement', { message: '사본 재제출', requestedDocs: ['ECOMMERCE_REG'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'applications'] });
    } finally {
      patch.mockRestore();
    }
  });
});

describe('정산 관리 (A안 — 고른 주차만 API 조회)', () => {
  it('ISO 주차 — 해가 바뀌는 주는 목요일이 속한 해', () => {
    expect(isoWeek(new Date(2026, 9, 19))).toBe('2026-W43');
    expect(isoWeek(new Date(2025, 11, 29))).toBe('2026-W01');
    expect(isoWeek(new Date(2020, 11, 28))).toBe('2020-W53');
    expect(isoWeek(new Date(2027, 0, 4))).toBe('2027-W01');
  });

  it('주차 선택 — 지난주부터 8주, 월요일이어도 이번 주는 빠진다', () => {
    const weeks = recentWeeks(new Date(2026, 9, 26));
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toMatchObject({ key: '2026-W43', start: new Date(2026, 9, 19) });
    expect(weeks.at(-1).key).toBe('2026-W36');
    expect(recentWeeks(new Date(2026, 10, 1))[0].key).toBe('2026-W43'); // 일요일
  });

  it('주차 목록 → 화면 필드 (상태 라벨 · 실효 수수료율)', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { week: '2026-W43', totals: {}, settlements: [
      { id: 6, storeId: 15, storeName: '숲속공방', weekStart: '2026-10-19', itemCount: 1, carriedOverCount: 0, salesAmt: 54000,
        commissionAmt: 4860, paymentFeeAmt: 1188, payoutAmt: 47952, status: 'HELD', holdReason: '스토어 정지 · 폐점 — 자동 보류' }] } } });
    try {
      expect(await load(useAdminSettlementWeekQuery, '2026-W43')).toMatchObject([{ id: 6, storeName: '숲속공방', orders: 1, gross: 54000,
        rate: 0.09, commission: 4860, pgFee: 1188, payout: 47952, status: '지급보류', holdReason: '스토어 정지 · 폐점 — 자동 보류' }]);
      expect(get).toHaveBeenCalledWith('/api/admin/settlements', { params: { week: '2026-W43' } });
    } finally {
      get.mockRestore();
    }
  });

  it('지급 실행 {ids} · 선택 보류는 건마다 PATCH · 보류 해제 — 끝나면 정산 목록 다시 불러오기', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { success: [1], failed: [] } } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: {} } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    try {
      const pay = renderHook(() => usePaySettlementsMutation(), { wrapper: Wrapper }).result;
      expect(await act(() => pay.current.mutateAsync([1]))).toEqual({ success: [1], failed: [] });
      expect(post).toHaveBeenCalledWith('/api/admin/settlements/pay', { ids: [1] });

      const hold = renderHook(() => useHoldSettlementsMutation(), { wrapper: Wrapper }).result;
      await act(() => hold.current.mutateAsync({ ids: [3, 7], reason: '계좌 확인' }));
      expect(patch).toHaveBeenCalledWith('/api/admin/settlements/3/hold', { hold: true, reason: '계좌 확인' });
      expect(patch).toHaveBeenCalledWith('/api/admin/settlements/7/hold', { hold: true, reason: '계좌 확인' });
      const release = renderHook(() => useReleaseSettlementHoldMutation(), { wrapper: Wrapper }).result;
      await act(() => release.current.mutateAsync(6));
      expect(patch).toHaveBeenCalledWith('/api/admin/settlements/6/hold', { hold: false, reason: undefined });
      expect(invalidate).toHaveBeenCalledTimes(3);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'settlements'] });
    } finally {
      post.mockRestore();
      patch.mockRestore();
    }
  });
});

describe('카테고리 · 수수료 mutation', () => {
  it('새 카테고리는 POST · 수정은 PUT /{id} · 수수료 예약은 PUT /commissions — 끝나면 카테고리 목록 다시 불러오기', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { id: 604 } } });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: { id: 3 } } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    try {
      const save = renderHook(() => useSaveCategoryMutation(), { wrapper: Wrapper }).result;
      await act(() => save.current.mutateAsync({ request: { name: '반려동물', commissionRate: 8 } }));
      expect(post).toHaveBeenCalledWith('/api/admin/categories', { name: '반려동물', commissionRate: 8 });
      await act(() => save.current.mutateAsync({ categoryId: 3, request: { name: '패션', active: true } }));
      expect(put).toHaveBeenCalledWith('/api/admin/categories/3', { name: '패션', active: true });

      const reserve = renderHook(() => useReserveCommissionMutation(), { wrapper: Wrapper }).result;
      await act(() => reserve.current.mutateAsync([{ categoryId: 3, rate: 12 }]));
      expect(put).toHaveBeenCalledWith('/api/admin/commissions', [{ categoryId: 3, rate: 12 }]);
      expect(invalidate).toHaveBeenCalledTimes(3);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'categories'] });
    } finally {
      post.mockRestore();
      put.mockRestore();
    }
  });
});

describe('판매자 정산 · 관리자 정산 상세 · 지금 집계 (settlement API)', () => {
  const SUMMARY = { id: 2, storeId: 1, storeName: '산골농부 박씨네', week: '2026-W42', weekStart: '2026-10-12', weekEnd: '2026-10-18',
    itemCount: 2, carriedOverCount: 1, salesAmt: 58000, commissionAmt: 4060, paymentFeeAmt: 1276, payoutAmt: 52664, status: 'PAID',
    holdReason: null, scheduledPayDate: '2026-10-22', paidAt: '2026-10-22T10:00:00+09:00', bank: { bankName: '곳간은행', accountNumber: '100-01', accountHolder: '박씨' } };
  const DETAIL = { settlement: SUMMARY,
    items: [{ orderItemId: 1004, orderNo: '20261012-901004', productName: '한라봉 3kg', confirmedAt: '2026-10-13T10:00:00+09:00', itemAmt: 39000,
      categoryId: 1, rate: 7.0, commission: 2730, paymentFee: 858, payout: 35412, carriedOver: true }],
    history: [{ at: '2026-10-19T03:00:00+09:00', actor: 'SYSTEM', from: null, to: 'SCHEDULED', reason: null },
      { at: '2026-10-22T10:00:00+09:00', actor: 'ADMIN', from: 'SCHEDULED', to: 'PAID', reason: null }] };

  it('판매자 목록 + 요약 — 카테고리 이름은 공개 트리에서, 율은 비율로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url === '/api/categories'
      ? [{ id: 1, name: '식품', children: [] }]
      : { summary: { nextPayout: { settlementId: 1, week: '2026-W43', payoutAmt: 61744, scheduledPayDate: '2026-10-29', status: 'SCHEDULED' },
        paidRecent8WeeksAmt: 52664, pendingPayoutAmt: 12000, appliedRates: [{ categoryId: 1, rate: 7.0 }] }, settlements: [SUMMARY] } } }));
    try {
      const data = await load(useSellerSettlementsQuery);
      expect(data.summary).toMatchObject({ pendingPayout: 12000, paidRecent8Weeks: 52664, nextPayout: { payout: 61744 }, rates: [{ name: '식품', rate: 0.07 }] });
      expect(data.rows[0]).toMatchObject({ id: 2, week: '2026-W42', orders: 2, carriedOver: 1, payout: 52664, status: '지급완료', bank: '곳간은행 100-01 (박씨)' });
      expect(await load(useSellerPendingQuery)).toEqual({ payout: 12000 });
    } finally {
      get.mockRestore();
    }
  });

  it('상세 — 판매자 · 관리자 같은 모양(건별 이월 · 율 · 이력 라벨), id 없으면 조회 안 함', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: DETAIL } });
    try {
      const expected = { storeName: '산골농부 박씨네', items: [{ productName: '한라봉 3kg', rate: 0.07, carriedOver: true }],
        history: [{ from: null, to: '지급예정', actor: 'SYSTEM' }, { from: '지급예정', to: '지급완료' }] };
      expect(await load(useSellerSettlementQuery, 2)).toMatchObject(expected);
      expect(get).toHaveBeenLastCalledWith('/api/seller/settlements/2');
      expect(await load(useAdminSettlementQuery, 2)).toMatchObject(expected);
      expect(get).toHaveBeenLastCalledWith('/api/admin/settlements/2');
    } finally {
      get.mockRestore();
    }
    const { Wrapper } = createWrapper();
    expect(renderHook(() => useSellerSettlementQuery(null), { wrapper: Wrapper }).result.current.fetchStatus).toBe('idle');
  });

  it('지금 집계 — 고른 주차로 POST, 끝나면 정산 목록 다시 불러오기', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { week: '2026-W43', created: 2, updated: 0, autoHeld: 0, carriedOver: 0 } } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    try {
      const { result } = renderHook(() => useAggregateSettlementsMutation(), { wrapper: Wrapper });
      expect(await act(() => result.current.mutateAsync('2026-W43'))).toMatchObject({ created: 2 });
      expect(post).toHaveBeenCalledWith('/api/admin/settlements/aggregate', { week: '2026-W43' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'settlements'] });
    } finally {
      post.mockRestore();
    }
  });
});

describe('신고 (admin-service — 접수 · 대상별 묶음 · 상세 · 처리)', () => {
  it('목록 — 대상별 묶음에 화면 id · 시각 변환, 상세는 신고 · 조치 시각 변환', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url === '/api/admin/reports'
      ? [{ targetType: 'REVIEW', targetId: 31, summary: '광고', openCount: 2, totalCount: 2, reasonCounts: { SPAM: 2 },
        lastReportedAt: '2026-10-26T15:00:00+09:00', lastAction: null }]
      : { targetType: 'USER', targetId: 12, target: { name: '홍길동' }, targetError: null,
        reports: [{ reportId: 7, reasonCode: 'FRAUD', status: 'RESOLVED', createdAt: '2026-10-26T15:00:00+09:00' }],
        actions: [{ moderationActionId: 3, action: 'SUSPEND', suspendDays: 7, createdAt: '2026-10-26T16:00:00+09:00' }] } } }));
    try {
      const list = await load(useAdminReportsQuery);
      expect(list[0]).toMatchObject({ id: 'REVIEW-31', openCount: 2, lastAction: null });
      expect(list[0].lastReportedAt).toBeInstanceOf(Date);
      const detail = await load(useAdminReportQuery, 'USER', 12);
      expect(detail).toMatchObject({ target: { name: '홍길동' }, actions: [{ action: 'SUSPEND', suspendDays: 7 }] });
      expect(detail.reports[0].createdAt).toBeInstanceOf(Date);
      expect(get).toHaveBeenLastCalledWith('/api/admin/reports/USER/12');
    } finally {
      get.mockRestore();
    }
    const { Wrapper } = createWrapper();
    expect(renderHook(() => useAdminReportQuery('USER', undefined), { wrapper: Wrapper }).result.current.fetchStatus).toBe('idle');
  });

  it('처리 — 정지는 days 포함 · 기각은 days 없이, 끝나면 신고 목록과(회원이면) 회원도 다시 불러오기', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { action: { action: 'SUSPEND' }, closedReports: 1, target: {} } } });
    const { client, Wrapper } = createWrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    try {
      const { result } = renderHook(() => useResolveReportMutation(), { wrapper: Wrapper });
      await act(() => result.current.mutateAsync({ type: 'USER', id: 12, action: 'SUSPEND', reason: '결제 도용', days: 7 }));
      expect(post).toHaveBeenLastCalledWith('/api/admin/reports/USER/12/resolve', { action: 'SUSPEND', reason: '결제 도용', days: 7 });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'reports'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'users'] });

      await act(() => result.current.mutateAsync({ type: 'REVIEW', id: 31, action: 'DISMISS', reason: '정상', days: null }));
      expect(post).toHaveBeenLastCalledWith('/api/admin/reports/REVIEW/31/resolve', { action: 'DISMISS', reason: '정상' });
    } finally {
      post.mockRestore();
    }
  });

  it('신고 접수 — POST /api/reports 본문 그대로', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { reportId: 7, status: 'OPEN' } } });
    const { Wrapper } = createWrapper();
    try {
      const { result } = renderHook(() => useCreateReportMutation(), { wrapper: Wrapper });
      const body = { targetType: 'REVIEW', targetId: 31, reasonCode: 'SELLER_REQUEST', detail: '욕설' };
      expect(await act(() => result.current.mutateAsync(body))).toEqual({ reportId: 7, status: 'OPEN' });
      expect(post).toHaveBeenCalledWith('/api/reports', body);
    } finally {
      post.mockRestore();
    }
  });
});
