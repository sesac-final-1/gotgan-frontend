import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProductCards } from '@/features/product/api/productApi';

// 임시 — 상품 전체 배열(공개 목록 최대 100개). 서버 페이징으로 바뀌어 화면은 useProductSearchQuery(params) · useProductQuery(id) 를 쓴다.
// 이 훅을 부르는 화면(상품명 조회용 리뷰 · 문의 · 판매자 센터 등)이 모두 옮겨 가면 삭제 — 담당 박지연
export function useProductsQuery() {
  return useQuery({
    queryKey: queryKeys.product.cards(),
    queryFn: () => fetchProductCards(),
  });
}
