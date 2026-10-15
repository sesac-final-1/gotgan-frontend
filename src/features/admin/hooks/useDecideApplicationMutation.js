import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { decideApplication } from '@/features/admin/api/adminApi';

// 입점 승인 · 보완요청 · 반려 — 담당 구지훈. 성공하면 목록 · 이력을 다시 불러온다 (변경 mutation 예시 — 컨벤션 4-6)
export function useDecideApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: decideApplication,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.applications() }); // 이력 키도 applications 하위라 함께 갱신
    },
  });
}
