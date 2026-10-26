import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { changeUserStatus } from '@/features/admin/api/adminApi';

// 회원 이용정지 · 해제 — 담당 구지훈. 성공하면 목록 · 상세를 다시 불러온다 (상태 · 정지 기간이 바뀜)
export function useChangeUserStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changeUserStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() }),
  });
}
