import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useAdminDashboardQuery } from '@/features/admin/hooks/useAdminDashboardQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminUserPointsQuery } from '@/features/admin/hooks/useAdminUserPointsQuery';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { useApplicationHistoryQuery } from '@/features/admin/hooks/useApplicationHistoryQuery';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useDecideApplicationMutation } from '@/features/admin/hooks/useDecideApplicationMutation';
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
  useAdminUsersQuery, useApplicationHistoryQuery, useApplicationsQuery, useMyOrdersQuery, useSellerBuyersQuery,
  useSellerOrderItemsQuery, useCategoriesQuery, useProductsQuery, useQnasQuery, useReviewsQuery, useSellerSettlementsQuery,
  useSellerDailySalesQuery, useStoresQuery,
};
const OBJECT_HOOKS = { useAdminDashboardQuery, useSellerPendingQuery, useMyStoreQuery };
// 실제 API 로 바꾼 훅 — 응답을 흉내 내 화면 필드로 오는지 (변환 세부는 features/user/userApi.test.js)
const API_HOOKS = {
  useMeQuery: [{ userId: 4, name: '구매자1', grade: 'NORMAL', point: 0, totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' }, { id: 4 }],
  useMyPointsQuery: [{ balance: 0, history: [] }, { balance: 0, history: [] }],
  useMyAddressesQuery: [[{ id: 10, label: '집', main: true }], [{ id: 10, label: '집', main: true }]],
};
const API_HOOK_FNS = { useMeQuery, useMyPointsQuery, useMyAddressesQuery };

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
    expect(await load(useAdminUserPointsQuery, 'u1')).toBeDefined();

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
