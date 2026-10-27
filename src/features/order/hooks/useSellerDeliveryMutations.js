import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { confirmOrderItems, deliverOrderItems, shipOrderItems } from '@/features/order/api/orderApi';

// 판매자 배송 처리 — 담당 이경석. 결과 { succeeded, failed } 는 화면이 행마다 표시 (utils/sellerBulk). 끝나면 목록 · 상세 · 탭 숫자 다시 불러오기
function useSellerMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.order.seller() }),
  });
}

export const useConfirmOrderItemsMutation = () => useSellerMutation((orderItemIds) => confirmOrderItems(orderItemIds));
export const useShipOrderItemsMutation = () => useSellerMutation((items) => shipOrderItems(items));
export const useDeliverOrderItemsMutation = () => useSellerMutation((orderItemIds) => deliverOrderItems(orderItemIds));
