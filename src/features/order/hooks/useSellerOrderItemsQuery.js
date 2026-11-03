import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerOrderItem, fetchSellerOrderItems } from '@/features/order/api/orderApi';

// 판매자 주문 목록 { statusCounts, items(페이지) } — 담당 이경석. params: { status, q, page, size } (서버 페이징, 컨벤션 4-7)
export function useSellerOrderItemsQuery(params) {
  return useQuery({
    queryKey: queryKeys.order.sellerItems(params),
    queryFn: () => fetchSellerOrderItems(params),
    placeholderData: keepPreviousData, // 페이지 · 탭을 바꾸는 동안 이전 표를 유지
    refetchInterval: 30_000, // 새 주문은 판매자에게 실시간 알림이 없어 30초마다 다시 (컨벤션 4-6)
  });
}

// 판매자 주문 상세 — 없거나 남의 스토어면 404 → isError
export function useSellerOrderItemQuery(orderItemId) {
  return useQuery({
    queryKey: queryKeys.order.sellerItem(orderItemId),
    queryFn: () => fetchSellerOrderItem(orderItemId),
    enabled: Boolean(orderItemId),
    retry: false,
  });
}
