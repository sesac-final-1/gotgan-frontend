import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminUser } from '@/features/admin/api/adminApi';

// 회원 상세 — 담당 구지훈. 목록에 없는 phone · 정지 사유 · 정지 종료 시각까지 (GET /api/admin/users/{id})
export function useAdminUserQuery(userId) {
  return useQuery({
    queryKey: queryKeys.admin.user(userId),
    queryFn: () => fetchAdminUser(userId),
    enabled: !!userId,
  });
}
