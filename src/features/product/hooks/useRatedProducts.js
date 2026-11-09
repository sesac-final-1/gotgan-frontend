import { useMemo } from 'react';
import { useProductRatingsQuery } from '@/features/review/hooks/useProductReviews';

// 상품 카드에 별점 · 리뷰 수를 붙인다 — product 응답에는 없어 review 평점 API(review.md 10절)로 한 번에 묻는다
// 평점을 받은 상품만 rated 표시 — 못 받았으면(로딩 · review 장애) 화면이 별점을 숨겨 「리뷰 없는 상품」처럼 보이지 않게 한다
// 평점을 받기 전 기본값은 고정 배열 — 렌더마다 새 [] 면 아래 useMemo 가 매번 새 목록을 돌려 표가 다시 계산된다
const NO_RATINGS = [];

export function useRatedProducts(products) {
  const ids = useMemo(() => products.map((p) => p.id), [products]);
  const { data: ratings = NO_RATINGS } = useProductRatingsQuery(ids);
  return useMemo(() => {
    const byId = Object.fromEntries(ratings.map((r) => [r.productId, r]));
    return products.map((p) => (byId[p.id] ? { ...p, rated: true, rating: byId[p.id].averageRating, reviews: byId[p.id].reviewCount } : p));
  }, [products, ratings]);
}
