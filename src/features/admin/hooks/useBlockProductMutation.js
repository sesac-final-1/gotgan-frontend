import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { blockProduct } from '@/features/admin/api/adminApi';

// 상품 강제 판매중지 · 해제 — 담당 구지훈. 사용: block.mutate({ productId, storeId, blocked, reason }) → 그 스토어 상품 목록을 다시 불러온다
export function useBlockProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, blocked, reason }) => blockProduct({ productId, blocked, reason }),
    onSuccess: (_, { storeId }) => queryClient.invalidateQueries({ queryKey: queryKeys.admin.storeProducts(storeId) }),
  });
}
