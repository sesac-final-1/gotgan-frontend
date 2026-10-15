import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchApplications } from '@/features/admin/api/adminApi';

// 입점 신청 전체 — 담당 구지훈. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useApplicationsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.applications(),
    queryFn: () => fetchApplications(),
  });
}
