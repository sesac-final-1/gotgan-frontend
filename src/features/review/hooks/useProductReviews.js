import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProductRatings, fetchProductReviewSummary, fetchProductReviews } from '@/features/review/api/reviewApi';

// 상품 상세 공개 리뷰 — 담당 이경석. params: { productId, rating, photoOnly, sort, page, size } (서버 페이징, 컨벤션 4-7)
// 응답의 mine 은 누가 보느냐에 달려 키에 보는 사람을 넣는다 — 새로고침 때 로그인 복구 전 토큰 없이 받은 mine:false 를 복구 뒤 다시 받는다
export function useProductReviewsQuery(params) {
  const viewerId = useAuthStore((s) => s.user?.userId ?? null);
  return useQuery({
    queryKey: [...queryKeys.review.productList(params), viewerId],
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

// 상품 카드 별점 · 리뷰 수 — 목록 · 메인이 받은 상품 id 묶음으로 한 번에 (평점은 보조 정보라 실패해도 카드는 그대로)
export function useProductRatingsQuery(ids) {
  return useQuery({
    queryKey: queryKeys.review.productRatings(ids),
    queryFn: () => fetchProductRatings(ids),
    enabled: ids.length > 0,
  });
}
