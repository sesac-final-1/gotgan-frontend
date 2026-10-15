import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerOrderItems } from '@/features/order/api/orderApi';

// 판매자 상품주문 — 서버 페이징 대상 — 담당 이경석. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useSellerOrderItemsQuery(params) {
  return useQuery({
    queryKey: queryKeys.order.sellerItems(params),
    queryFn: () => fetchSellerOrderItems(params),
  });
}
