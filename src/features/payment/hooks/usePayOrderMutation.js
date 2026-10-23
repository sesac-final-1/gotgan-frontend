import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { payOrder } from '@/features/payment/payOrder';

// 주문서 결제 — 담당 구지훈. const r = await pay.mutateAsync(주문 생성 응답) → r.status 로 분기 (payOrder.js)
// 결과와 관계없이 내 주문 목록을 다시 불러온다 (결제 대기 · 완료 · 실패 모두 목록에 보임)
export function usePayOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payOrder,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.order.my() }),
  });
}
