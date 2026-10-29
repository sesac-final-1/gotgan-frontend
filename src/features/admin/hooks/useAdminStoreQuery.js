import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminStore } from '@/features/admin/api/adminApi';

// 스토어 상세 (관리자, 실제 API) — 담당 구지훈. 404 는 화면이 "찾을 수 없어요"로
export function useAdminStoreQuery(storeId) {
  return useQuery({
    queryKey: queryKeys.admin.store(storeId),
    queryFn: () => fetchAdminStore(storeId),
    enabled: !!storeId,
  });
}
