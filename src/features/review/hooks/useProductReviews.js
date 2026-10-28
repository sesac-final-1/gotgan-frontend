import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProductReviewSummary, fetchProductReviews } from '@/features/review/api/reviewApi';

// 상품 상세 공개 리뷰 — 담당 이경석. params: { productId, rating, photoOnly, sort, page, size } (서버 페이징, 컨벤션 4-7)
export function useProductReviewsQuery(params) {
  return useQuery({
    queryKey: queryKeys.review.productList(params),
    queryFn: () => fetchProductReviews(params),
    placeholderData: keepPreviousData, // 필터 · 정렬 · 페이지를 바꾸는 동안 이전 목록 유지
  });
}

// 상단 평균 · 별점 분포 · 사이즈 체감 분포
export function useProductReviewSummaryQuery(productId) {
  return useQuery({
    queryKey: queryKeys.review.productSummary(productId),
    queryFn: () => fetchProductReviewSummary(productId),
  });
}
