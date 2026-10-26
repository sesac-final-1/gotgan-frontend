import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { resolveReport } from '@/features/admin/api/adminApi';

// 신고 처리(블라인드 · 정지 · 해제 · 기각) — 담당 구지훈. 신고 목록 · 상세와, 정지면 회원 정보도 다시 불러온다
export function useResolveReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resolveReport,
    onSuccess: (_, { type }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.reports() }),
      type === 'USER' && queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() }),
    ]),
  });
}
