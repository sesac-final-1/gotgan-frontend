import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchCategories } from '@/features/product/api/productApi';

// 카테고리 목록 — 담당 박지연. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.product.categories(),
    queryFn: () => fetchCategories(),
  });
}
