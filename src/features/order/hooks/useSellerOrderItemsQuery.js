import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerOrderItem, fetchSellerOrderItems, fetchSellerOrderItemsMock } from '@/features/order/api/orderApi';

// 판매자 주문 목록 { statusCounts, items(페이지) } — 담당 이경석. params: { status, q, page, size } (서버 페이징, 컨벤션 4-7)
export function useSellerOrderItemsQuery(params) {
  return useQuery({
    queryKey: queryKeys.order.sellerItems(params),
    queryFn: () => fetchSellerOrderItems(params),
    placeholderData: keepPreviousData, // 페이지 · 탭을 바꾸는 동안 이전 표를 유지
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

// TODO(이경석): 임시 — 판매자 클레임(SellerClaimList) · 대시보드 최근 주문은 목업 모양. 판매자 클레임 API · 대시보드 연동 때 삭제
export function useSellerOrderItemsMockQuery() {
  return useQuery({
    queryKey: queryKeys.order.sellerItemsMock(),
    queryFn: () => fetchSellerOrderItemsMock(),
  });
}
