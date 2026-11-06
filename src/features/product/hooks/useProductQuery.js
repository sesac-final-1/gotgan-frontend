import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchProduct } from '@/features/product/api/productApi';
import { retryOnce } from '@/shared/api/retry';

// 상품 상세 — 담당 박지연. 없는 상품은 404 라 재시도하지 않는다(화면은 404 만 "상품을 찾을 수 없습니다", 그 밖의 실패는 다시 시도 안내)
export function useProductQuery(productId) {
  return useQuery({
    queryKey: queryKeys.product.detail(productId),
    queryFn: () => fetchProduct(productId),
    enabled: Boolean(productId),
    retry: (count, error) => error?.response?.status !== 404 && retryOnce(count, error),
  });
}
