import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminStoreList } from '@/features/admin/api/adminApi';

// 스토어 목록(실제 API) — 담당 구지훈. 화면은 이 훅만 쓴다
export function useAdminStoreListQuery() {
  return useQuery({
    queryKey: queryKeys.admin.storeList(),
    queryFn: () => fetchAdminStoreList(),
  });
}
