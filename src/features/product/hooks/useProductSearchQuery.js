import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProducts, cleanParams } from '@/features/product/api/productApi';

// 상품 목록 · 검색 (서버 페이징, 컨벤션 4-7) — 담당 박지연. 목록 · 검색 · 메인(카테고리마다 { categoryId, sort: 'NEW', size: 8 }) · 스토어 홈({ storeId }) 공용
// 페이지 · 조건이 바뀌는 동안 이전 페이지를 그대로 보여 준다(keepPreviousData) → 표가 깜빡이지 않음
// 키와 요청 모두 빈 조건을 뺀 값으로 — 같은 요청은 같은 캐시. options.enabled 로 조건이 정해지기 전 요청을 막을 수 있다
export function useProductSearchQuery(params = {}, { enabled = true } = {}) {
  const query = cleanParams(params);
  return useQuery({
    queryKey: queryKeys.product.list(query),
    queryFn: () => fetchProducts(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}
