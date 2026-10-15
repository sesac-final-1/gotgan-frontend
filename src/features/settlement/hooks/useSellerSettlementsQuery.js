import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerSettlements } from '@/features/settlement/api/settlementApi';

// 판매자 정산 내역 — 담당 구지훈. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useSellerSettlementsQuery() {
  return useQuery({
    queryKey: queryKeys.settlement.seller(),
    queryFn: () => fetchSellerSettlements(),
  });
}
