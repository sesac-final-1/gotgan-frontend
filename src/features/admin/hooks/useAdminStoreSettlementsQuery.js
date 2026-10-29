import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminStoreSettlements } from '@/features/admin/api/adminApi';

// 스토어 최근 8주 정산서 (관리자 스토어 상세) — 담당 구지훈. storeId 가 없으면 조회하지 않는다
export function useAdminStoreSettlementsQuery(storeId) {
  return useQuery({
    queryKey: queryKeys.admin.storeSettlements(storeId),
    queryFn: () => fetchAdminStoreSettlements(storeId),
    enabled: !!storeId,
  });
}
