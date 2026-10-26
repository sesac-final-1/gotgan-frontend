import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerSettlement } from '@/features/settlement/api/settlementApi';

// 판매자 정산 상세 — 담당 구지훈. id 가 있을 때만 (상세 모달을 열 때)
export function useSellerSettlementQuery(id) {
  return useQuery({
    queryKey: queryKeys.settlement.sellerDetail(id),
    queryFn: () => fetchSellerSettlement(id),
    enabled: id != null,
  });
}
