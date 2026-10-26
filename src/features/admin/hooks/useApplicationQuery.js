import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchApplication } from '@/features/admin/api/adminApi';

// 입점 신청 상세 — 담당 구지훈. 신청서 · 서류 링크 · 처리 이력 · 같은 사업자번호 신청/스토어
export function useApplicationQuery(id) {
  return useQuery({
    queryKey: queryKeys.admin.application(id),
    queryFn: () => fetchApplication(id),
    enabled: Boolean(id),
  });
}
