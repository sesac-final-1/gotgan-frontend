import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminSettlement } from '@/features/admin/api/adminApi';

// 관리자 정산 상세 (지급 전 확인) — 담당 구지훈. id 가 있을 때만
export function useAdminSettlementQuery(id) {
  return useQuery({
    queryKey: queryKeys.admin.settlement(id),
    queryFn: () => fetchAdminSettlement(id),
    enabled: id != null,
  });
}
