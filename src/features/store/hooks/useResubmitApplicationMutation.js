import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { resubmitApplication } from '@/features/store/api/sellerApplyApi';

// 보완 재제출 — 담당 박지연. 서류 업로드 → 재제출 → 내 신청 상태를 다시 불러 "심사대기"(이력에 재제출) 화면으로
export function useResubmitApplicationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resubmitApplication,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.store.myApplication() }),
  });
}
