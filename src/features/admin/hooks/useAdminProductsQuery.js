import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminProducts } from '@/features/admin/api/adminApi';

// 상품 목록 (관리자) — 담당 구지훈. 스토어 · 카테고리 상품 수, 스토어 상세 상품 표, 리뷰 상품명
export function useAdminProductsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.products(),
    queryFn: () => fetchAdminProducts(),
  });
}
