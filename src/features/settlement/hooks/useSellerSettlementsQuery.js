import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerSettlements } from '@/features/settlement/api/settlementApi';

// 판매자 정산 내역 — 담당 구지훈. { summary, rows } (GET /api/seller/settlements)
export function useSellerSettlementsQuery() {
  return useQuery({
    queryKey: queryKeys.settlement.seller(),
    queryFn: () => fetchSellerSettlements(),
  });
}
