import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyOrders, fetchMyOrdersMock } from '@/features/order/api/orderApi';

// 내 주문 전체 { statusCounts, orders } — 담당 이경석 (GET /api/orders)
export function useMyOrdersQuery() {
  return useQuery({
    queryKey: queryKeys.order.my(),
    queryFn: () => fetchMyOrders(),
  });
}

// TODO(이경석): 임시 — 리뷰 작성 가능 목록(MyReviews · 마이페이지 배지)은 reviewed 필드가 있는 목업. 리뷰 API 가 나오면 삭제
export function useMyOrdersMockQuery() {
  return useQuery({
    queryKey: queryKeys.order.myMock(),
    queryFn: () => fetchMyOrdersMock(),
  });
}
