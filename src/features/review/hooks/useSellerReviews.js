import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerReviewSummary, fetchSellerReviews, replyToReview } from '@/features/review/api/reviewApi';

// 판매자 리뷰 관리 — 담당 이경석. params: { tab, productId, page, size } (서버 페이징, 컨벤션 4-7)
export function useSellerReviewsQuery(params) {
  return useQuery({
    queryKey: queryKeys.review.sellerList(params),
    queryFn: () => fetchSellerReviews(params),
    placeholderData: keepPreviousData, // 탭 · 상품 · 페이지를 바꾸는 동안 이전 목록 유지
  });
}

// 상단 평균 · 분포 · 상품별 평균 · 탭 숫자
export function useSellerReviewSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.review.sellerSummary(),
    queryFn: () => fetchSellerReviewSummary(),
  });
}

// 답글 작성 · 수정 — 성공하면 목록 · 탭 숫자(답글 미작성)를 다시 불러온다
export function useReplyReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }) => replyToReview(id, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.review.seller() }),
  });
}
