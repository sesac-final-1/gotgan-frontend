import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProduct } from '@/features/product/api/productApi';

// 상품 상세 — 담당 박지연. 없는 상품은 404 라 재시도하지 않는다(화면은 isError 로 "상품을 찾을 수 없습니다")
export function useProductQuery(productId) {
  return useQuery({
    queryKey: queryKeys.product.detail(productId),
    queryFn: () => fetchProduct(productId),
    enabled: Boolean(productId),
    retry: (count, error) => error?.response?.status !== 404 && count < 1,
  });
}
