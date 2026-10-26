import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyOrder } from '@/features/order/api/orderApi';

// 내 주문 상세 — 담당 이경석 (GET /api/orders/{orderNo}). 없는 · 남의 주문은 404 → isError
export function useMyOrderQuery(orderNo) {
  return useQuery({
    queryKey: queryKeys.order.myOrder(orderNo),
    queryFn: () => fetchMyOrder(orderNo),
    enabled: Boolean(orderNo),
    retry: false,
  });
}
