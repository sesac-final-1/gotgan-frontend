import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchStore } from '@/features/store/api/storeApi';

// 스토어 홈 — 담당 박지연. 정지 · 폐점도 200 으로 오고(status 로 화면이 나눔), 없는 스토어는 404 라 재시도하지 않는다
export function useStoreQuery(storeId) {
  return useQuery({
    queryKey: queryKeys.store.detail(storeId),
    queryFn: () => fetchStore(storeId),
    enabled: Boolean(storeId),
    retry: (count, error) => error?.response?.status !== 404 && count < 1,
  });
}
