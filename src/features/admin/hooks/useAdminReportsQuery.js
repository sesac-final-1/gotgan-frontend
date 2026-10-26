import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminReports } from '@/features/admin/api/adminApi';

// 신고 관리 목록 (대상별 묶음) — 담당 구지훈. 메뉴 배지 · 대시보드 할 일도 openCount 합으로
export function useAdminReportsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.reports(),
    queryFn: () => fetchAdminReports(),
  });
}
