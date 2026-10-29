import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { aggregateSettlements, holdSettlement, paySettlements } from '@/features/admin/api/adminApi';

// 정산 지급 · 보류 — 담당 구지훈. 성공하면 정산 목록 · 대시보드(메뉴의 지급 보류 배지)를 다시 불러온다 (일부 실패여도 성공한 건은 반영)
function useSettlementMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.settlements() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() }),
    ]),
  });
}

export const usePaySettlementsMutation = () => useSettlementMutation(paySettlements);
// 보류 · 해제 모두 PATCH /hold — 여러 건 보류는 건마다 호출
export const useHoldSettlementsMutation = () =>
  useSettlementMutation(({ ids, reason }) => Promise.allSettled(ids.map((id) => holdSettlement({ id, hold: true, reason }))));
export const useReleaseSettlementHoldMutation = () => useSettlementMutation((id) => holdSettlement({ id, hold: false }));
// 지금 집계 — 고른 주차를 바로 집계 (자동 집계는 월 03:00 · 기동 시 지난주라 시연 때 필요)
export const useAggregateSettlementsMutation = () => useSettlementMutation(aggregateSettlements);
