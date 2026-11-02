import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerProducts } from '@/features/product/api/productApi';

// 내 스토어 상품 전체 — 담당 박지연. 판매중지 · 강제중지 · 쇼핑몰 미노출 상품까지 모두 (product.md 11절)
export function useSellerProductsQuery() {
  return useQuery({
    queryKey: queryKeys.product.sellerList(),
    queryFn: () => fetchSellerProducts(),
  });
}
