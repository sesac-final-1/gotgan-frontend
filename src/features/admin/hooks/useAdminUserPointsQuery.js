import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminUserPoints } from '@/features/admin/api/adminApi';

// 회원 포인트 내역 — 담당 구지훈. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useAdminUserPointsQuery(userId) {
  return useQuery({
    queryKey: queryKeys.admin.userPoints(userId),
    queryFn: () => fetchAdminUserPoints(userId),
    enabled: !!userId,
  });
}
