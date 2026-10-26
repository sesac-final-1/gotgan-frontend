import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { reserveCommissions, saveCategory } from '@/features/admin/api/adminApi';

// 카테고리 · 수수료 변경 — 담당 구지훈. 성공하면 카테고리 목록(수수료 포함)을 다시 불러온다
function useCategoryMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories() }),
  });
}

export const useSaveCategoryMutation = () => useCategoryMutation(saveCategory);
export const useReserveCommissionMutation = () => useCategoryMutation(reserveCommissions);
