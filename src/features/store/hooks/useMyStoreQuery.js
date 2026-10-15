import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyStore } from '@/features/store/api/storeApi';

// 로그인한 판매자의 스토어 — 담당 박지연. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useMyStoreQuery() {
  return useQuery({
    queryKey: queryKeys.store.mine(),
    queryFn: () => fetchMyStore(),
  });
}
