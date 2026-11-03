import { useMutation } from '@tanstack/react-query';
import { fetchSettlementReportUrl } from '@/features/settlement/api/settlementApi';

// 정산 명세서 링크 — 담당 구지훈. 누를 때마다 10분짜리 presigned 링크를 새로 받으므로 캐시하는 조회가 아니라 mutation
export function useSettlementReportMutation() {
  return useMutation({ mutationFn: (settlementId) => fetchSettlementReportUrl(settlementId) });
}
