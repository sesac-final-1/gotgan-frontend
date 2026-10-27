import { act, renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAdminStoreProductsQuery } from '@/features/admin/hooks/useAdminStoreProductsQuery';
import { useBlockProductMutation } from '@/features/admin/hooks/useBlockProductMutation';

// 관리자 스토어 상품 · 강제 판매중지 (backend #110 · #112 — product 응답 그대로 전달)
const PRODUCTS = [{ productId: 101, name: '서귀포 노지 햇감귤 5kg', salePrice: 26980, totalStock: 900, status: 'ON_SALE', hiddenReason: null }];

afterEach(() => vi.restoreAllMocks());

describe('관리자 스토어 상품', () => {
  it('스토어 id 가 있을 때만 GET /api/admin/stores/{id}/products — 응답 배열 그대로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: PRODUCTS } });
    const { Wrapper } = createWrapper();

    const idle = renderHook(() => useAdminStoreProductsQuery(undefined), { wrapper: Wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(() => useAdminStoreProductsQuery('1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PRODUCTS);
    expect(get).toHaveBeenCalledWith('/api/admin/stores/1/products');
  });

  it('강제 판매중지 — PATCH 본문 {blocked, reason}, 끝나면 그 스토어 상품 목록을 다시 불러온다', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: PRODUCTS } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { productId: 101, status: 'BLOCKED', statusReason: '원산지 누락' } } });
    const { Wrapper, client: queryClient } = createWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useBlockProductMutation(), { wrapper: Wrapper });
    let response;
    await act(async () => {
      response = await result.current.mutateAsync({ productId: 101, storeId: '1', blocked: true, reason: '원산지 누락' });
    });

    expect(patch).toHaveBeenCalledWith('/api/admin/products/101/block', { blocked: true, reason: '원산지 누락' });
    expect(response.status).toBe('BLOCKED');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'stores', '1', 'products'] });
  });
});
