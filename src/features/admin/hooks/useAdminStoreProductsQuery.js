import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminStoreProducts } from '@/features/admin/api/adminApi';

// 스토어 상품 목록 (관리자, 실제 API) — 담당 구지훈. storeId 가 없으면 조회하지 않는다
export function useAdminStoreProductsQuery(storeId) {
  return useQuery({
    queryKey: queryKeys.admin.storeProducts(storeId),
    queryFn: () => fetchAdminStoreProducts(storeId),
    enabled: !!storeId,
  });
}
