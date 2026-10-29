import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { changeStoreStatus } from '@/features/admin/api/adminApi';

// 스토어 정지 · 해제 — 담당 구지훈. 성공하면 스토어 목록 · 상세를 다시 불러온다 (상태가 바뀜)
export function useChangeStoreStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changeStoreStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.stores() }),
  });
}
