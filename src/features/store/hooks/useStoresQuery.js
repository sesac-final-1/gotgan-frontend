import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchStores } from '@/features/store/api/storeApi';

// 스토어 목록 — 담당 박지연. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useStoresQuery() {
  return useQuery({
    queryKey: queryKeys.store.list(),
    queryFn: () => fetchStores(),
  });
}
