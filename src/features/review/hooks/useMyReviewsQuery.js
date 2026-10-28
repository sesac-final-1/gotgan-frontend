import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyReviews, fetchWritableReviews } from '@/features/review/api/reviewApi';

// 마이페이지 리뷰 관리 — 담당 이경석. 내가 쓴 리뷰 (GET /api/reviews/me)
export function useMyReviewsQuery() {
  return useQuery({
    queryKey: queryKeys.review.myList(),
    queryFn: () => fetchMyReviews(),
  });
}

// 작성 가능한 리뷰 (GET /api/reviews/me/writable) — 마이페이지 배지 숫자도 이 목록 길이
export function useWritableReviewsQuery() {
  return useQuery({
    queryKey: queryKeys.review.writable(),
    queryFn: () => fetchWritableReviews(),
  });
}
