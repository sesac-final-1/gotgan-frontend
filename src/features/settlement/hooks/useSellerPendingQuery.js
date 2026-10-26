import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerPending } from '@/features/settlement/api/settlementApi';

// 이번 주 정산 예정액 { payout } — 담당 구지훈. 판매자 대시보드용 (GET /api/seller/settlements 요약)
export function useSellerPendingQuery() {
  return useQuery({
    queryKey: queryKeys.settlement.sellerPending(),
    queryFn: () => fetchSellerPending(),
  });
}
