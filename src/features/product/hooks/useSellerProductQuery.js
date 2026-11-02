import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerProduct } from '@/features/product/api/productApi';

// 판매자 상품 상세(수정 화면) — 담당 박지연. 다른 스토어 · 없는 상품은 404 라 재시도하지 않는다 (product.md 12절)
export function useSellerProductQuery(productId) {
  return useQuery({
    queryKey: queryKeys.product.sellerDetail(productId),
    queryFn: () => fetchSellerProduct(productId),
    enabled: Boolean(productId),
    retry: (count, error) => error?.response?.status !== 404 && count < 1,
  });
}
