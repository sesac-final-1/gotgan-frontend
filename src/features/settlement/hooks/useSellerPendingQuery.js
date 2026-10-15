import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerPending } from '@/features/settlement/api/settlementApi';

// 이번 주 집계중 금액 — 담당 구지훈. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useSellerPendingQuery() {
  return useQuery({
    queryKey: queryKeys.settlement.sellerPending(),
    queryFn: () => fetchSellerPending(),
  });
}
