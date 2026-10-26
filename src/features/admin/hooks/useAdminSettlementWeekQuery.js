import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminSettlementWeek } from '@/features/admin/api/adminApi';

// 정산 관리 — 담당 구지훈. 고른 주차(ISO 2026-W43)만 조회, 생략 = 지난주
export function useAdminSettlementWeekQuery(week) {
  return useQuery({
    queryKey: queryKeys.admin.settlementWeek(week),
    queryFn: () => fetchAdminSettlementWeek(week),
  });
}
