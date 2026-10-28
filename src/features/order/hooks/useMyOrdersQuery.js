import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyOrders } from '@/features/order/api/orderApi';

// 내 주문 전체 { statusCounts, orders } — 담당 이경석 (GET /api/orders)
export function useMyOrdersQuery() {
  return useQuery({
    queryKey: queryKeys.order.my(),
    queryFn: () => fetchMyOrders(),
  });
}
