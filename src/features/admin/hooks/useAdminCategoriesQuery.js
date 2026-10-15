import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminCategories } from '@/features/admin/api/adminApi';

// 카테고리 · 수수료 — 담당 구지훈. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useAdminCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.admin.categories(),
    queryFn: () => fetchAdminCategories(),
  });
}
