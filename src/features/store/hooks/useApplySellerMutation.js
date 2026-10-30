import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { applySeller } from '@/features/store/api/sellerApplyApi';

// 입점 신청 제출 — 담당 박지연. 서류 업로드 → 신청 → 내 신청 상태를 다시 불러 "심사대기" 화면으로
export function useApplySellerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applySeller,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.store.myApplication() }),
  });
}
