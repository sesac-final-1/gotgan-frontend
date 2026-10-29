import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProducts } from '@/features/product/api/productApi';

// 상품 목록 · 검색 (서버 페이징, 컨벤션 4-7) — 담당 박지연. 목록 · 검색 · 메인(카테고리마다 { categoryId, sort: 'NEW', size: 8 }) · 스토어 홈({ storeId }) 공용
// 페이지 · 조건이 바뀌는 동안 이전 페이지를 그대로 보여 준다(keepPreviousData) → 표가 깜빡이지 않음
export function useProductSearchQuery(params = {}) {
  return useQuery({
    queryKey: queryKeys.product.list(params),
    queryFn: () => fetchProducts(params),
    placeholderData: keepPreviousData,
  });
}
