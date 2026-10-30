import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyApplication } from '@/features/store/api/sellerApplyApi';

// 내 입점 신청 상태 — 담당 박지연. 신청한 적 없으면 data 가 null (폼), 있으면 status 별 안내 화면
export function useMyApplicationQuery() {
  return useQuery({
    queryKey: queryKeys.store.myApplication(),
    queryFn: () => fetchMyApplication(),
  });
}
