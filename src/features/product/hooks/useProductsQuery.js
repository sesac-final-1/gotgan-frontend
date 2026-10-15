import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProducts } from '@/features/product/api/productApi';

// 상품 전체 — 구매자 목록은 서버 페이징으로 바뀔 예정 — 담당 박지연. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useProductsQuery() {
  return useQuery({
    queryKey: queryKeys.product.list(),
    queryFn: () => fetchProducts(),
  });
}
