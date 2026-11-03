import { useMemo } from 'react';
import { useProductRatingsQuery } from '@/features/review/hooks/useProductReviews';

// 상품 카드에 별점 · 리뷰 수를 붙인다 — product 응답에는 없어 review 평점 API(review.md 10절)로 한 번에 묻는다
// 평점을 못 받으면 카드 기본값(0 · 0) 그대로
// 평점을 받기 전 기본값은 고정 배열 — 렌더마다 새 [] 면 아래 useMemo 가 매번 새 목록을 돌려 표가 다시 계산된다
const NO_RATINGS = [];

export function useRatedProducts(products) {
  const ids = useMemo(() => products.map((p) => p.id), [products]);
  const { data: ratings = NO_RATINGS } = useProductRatingsQuery(ids);
  return useMemo(() => {
    const byId = Object.fromEntries(ratings.map((r) => [r.productId, r]));
    return products.map((p) => (byId[p.id] ? { ...p, rating: byId[p.id].averageRating, reviews: byId[p.id].reviewCount } : p));
  }, [products, ratings]);
}
