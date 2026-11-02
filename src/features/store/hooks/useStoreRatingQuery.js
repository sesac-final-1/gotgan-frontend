import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchStoreRating } from '@/features/store/api/storeApi';

// 스토어 홈 별점 — 담당 박지연. 보조 정보라 실패하면 화면은 0 으로 둔다
export function useStoreRatingQuery(storeId) {
  return useQuery({
    queryKey: queryKeys.store.rating(storeId),
    queryFn: () => fetchStoreRating(storeId),
    enabled: Boolean(storeId),
  });
}
