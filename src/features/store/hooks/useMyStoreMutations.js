import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { updateMyStore, closeMyStore } from '@/features/store/api/storeApi';

// 내 스토어 변경 — 담당 박지연. 끝나면 store 전체(내 스토어 · 공개 스토어 홈 · 목록)를 다시 불러온다

function useMyStoreMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.store.all }),
  });
}

// 13-2 요청 → 바뀐 설정
export const useUpdateMyStoreMutation = () => useMyStoreMutation(updateMyStore);

// 폐점(12절) → { storeId, status, closedAt }
export const useCloseMyStoreMutation = () => useMyStoreMutation(closeMyStore);
