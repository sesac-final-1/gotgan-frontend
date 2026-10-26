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
import { useSaveCategoryMutation, useReserveCommissionMutation } from '@/features/admin/hooks/useCategoryMutations';
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
  useAdminProductsQuery, useAdminReviewsQuery, useAdminSettlementsQuery, useAdminStoresQuery,
  useApplicationHistoryQuery, useApplicationsQuery, useMyOrdersQuery, useSellerBuyersQuery,
  useSellerOrderItemsQuery, useCategoriesQuery, useProductsQuery, useQnasQuery, useReviewsQuery, useSellerSettlementsQuery,
  useSellerDailySalesQuery, useStoresQuery,
};
const OBJECT_HOOKS = { useAdminDashboardQuery, useSellerPendingQuery, useMyStoreQuery };
// 실제 API 로 바꾼 훅 — 응답을 흉내 내 화면 필드로 오는지 (변환 세부는 features/user/userApi.test.js)
const API_HOOKS = {
  useAdminUsersQuery: [{ content: [{ userId: 4, name: '구매자1', status: 'SUSPENDED', totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' }], hasNext: false },
    [{ id: '4', name: '구매자1', status: '이용정지' }]],
  useMeQuery: [{ userId: 4, name: '구매자1', grade: 'NORMAL', point: 0, totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' }, { id: 4 }],
  useMyPointsQuery: [{ balance: 0, history: [] }, { balance: 0, history: [] }],
  useMyAddressesQuery: [[{ id: 10, label: '집', main: true }], [{ id: 10, label: '집', main: true }]],
};
const API_HOOK_FNS = { useMeQuery, useMyPointsQuery, useMyAddressesQuery, useAdminUsersQuery };

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
