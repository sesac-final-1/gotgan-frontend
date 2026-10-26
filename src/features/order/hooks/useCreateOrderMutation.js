import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { createOrder } from '@/features/order/api/orderApi';

// 주문 생성 — 담당 이경석. const created = await create.mutateAsync(toOrderRequest(...)) → usePayOrderMutation 으로 결제창 · 결제 확인
// 성공하면 포인트가 이미 차감됐으므로 잔액 · 내역을 다시 불러온다 (결제 대기 주문은 내 주문 목록에도 보임)
export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.points() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.order.my() });
    },
  });
}
