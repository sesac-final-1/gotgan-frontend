import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchAdminReport } from '@/features/admin/api/adminApi';

// 신고 상세 (REVIEW · USER) — 담당 구지훈. 회원 상세의 제재 · 신고 이력도 이 훅 (type 'USER'). id 가 있을 때만
export function useAdminReportQuery(type, id) {
  return useQuery({
    queryKey: queryKeys.admin.report(type, id),
    queryFn: () => fetchAdminReport({ type, id }),
    enabled: Boolean(type && id),
  });
}
