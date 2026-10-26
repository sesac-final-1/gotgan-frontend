import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useAdminDashboardQuery } from '@/features/admin/hooks/useAdminDashboardQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminSettlementWeekQuery } from '@/features/admin/hooks/useAdminSettlementWeekQuery';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminUserPointsQuery } from '@/features/admin/hooks/useAdminUserPointsQuery';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { useApplicationHistoryQuery } from '@/features/admin/hooks/useApplicationHistoryQuery';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useDecideApplicationMutation } from '@/features/admin/hooks/useDecideApplicationMutation';
import { usePaySettlementsMutation, useHoldSettlementsMutation, useReleaseSettlementHoldMutation } from '@/features/admin/hooks/useSettlementMutations';
import { isoWeek, recentWeeks } from '@/features/admin/constants';
import { useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useSellerBuyersQuery } from '@/features/order/hooks/useSellerBuyersQuery';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useQnasQuery } from '@/features/review/hooks/useQnasQuery';
import { useReviewsQuery } from '@/features/review/hooks/useReviewsQuery';
import { useSellerPendingQuery } from '@/features/settlement/hooks/useSellerPendingQuery';
import { useSellerSettlementsQuery } from '@/features/settlement/hooks/useSellerSettlementsQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useSellerDailySalesQuery } from '@/features/store/hooks/useSellerDailySalesQuery';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import { useMyPointsQuery } from '@/features/user/hooks/useMyPointsQuery';

// 조회 훅 — 목업 api 를 거쳐 데이터가 도착하는지 (API 교체 후에도 같은 테스트로 MSW 응답 확인 가능)
const LIST_HOOKS = {
  useAdminCategoriesQuery, useAdminProductsQuery, useAdminReviewsQuery, useAdminSettlementsQuery, useAdminStoresQuery,
  useApplicationHistoryQuery, useApplicationsQuery, useMyOrdersQuery, useSellerBuyersQuery,
  useSellerOrderItemsQuery, useCategoriesQuery, useProductsQuery, useQnasQuery, useReviewsQuery, useSellerSettlementsQuery,
  useSellerDailySalesQuery, useStoresQuery,
};
const OBJECT_HOOKS = { useSellerPendingQuery, useMyStoreQuery };
// 실제 API 로 바꾼 훅 — 응답을 흉내 내 화면 필드로 오는지 (변환 세부는 features/user/userApi.test.js)
const API_HOOKS = {
  useAdminDashboardQuery: [{ settlement: null, order: { totalTradeAmt: 662000, orderCount: 14 }, unavailable: ['settlement'] },
    { settlement: null, order: { orderCount: 14 }, unavailable: ['settlement'] }],
  useAdminUsersQuery: [{ content: [{ userId: 4, name: '구매자1', status: 'SUSPENDED', totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' }], hasNext: false },
    [{ id: '4', name: '구매자1', status: '이용정지' }]],
  useMeQuery: [{ userId: 4, name: '구매자1', grade: 'NORMAL', point: 0, totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' }, { id: 4 }],
  useMyPointsQuery: [{ balance: 0, history: [] }, { balance: 0, history: [] }],
  useMyAddressesQuery: [[{ id: 10, label: '집', main: true }], [{ id: 10, label: '집', main: true }]],
};
const API_HOOK_FNS = { useAdminDashboardQuery, useMeQuery, useMyPointsQuery, useMyAddressesQuery, useAdminUsersQuery };

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

describe('입점 처리 mutation', () => {
  it('보완요청 → 신청 상태 변경 · 이력 1줄 추가 · 목록 다시 불러오기', async () => {
    const { client, Wrapper } = createWrapper();
    const apps = await load(useApplicationsQuery);
    const before = await load(useApplicationHistoryQuery);
    const target = apps.find((a) => a.status === '심사대기');
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDecideApplicationMutation(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ id: target.id, status: '보완요청', reason: '통장 사본 재제출' }));

    const after = await load(useApplicationHistoryQuery);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({ appId: target.id, from: '심사대기', to: '보완요청', reason: '통장 사본 재제출' });
    expect((await load(useApplicationsQuery)).find((a) => a.id === target.id).status).toBe('보완요청');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'applications'] });
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
