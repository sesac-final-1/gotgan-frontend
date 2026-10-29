import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminUserReviews } from '@/features/admin/api/adminApi';

// 회원 작성 리뷰(최근 5개) — 담당 구지훈. 화면은 이 훅만 쓴다
export function useAdminUserReviewsQuery(userId) {
  return useQuery({
    queryKey: queryKeys.admin.userReviews(userId),
    queryFn: () => fetchAdminUserReviews(userId),
    enabled: !!userId,
  });
}
