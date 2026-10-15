import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyPoints } from '@/features/user/api/userApi';

// 포인트 { balance, history } — 담당 이경석. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useMyPointsQuery() {
  return useQuery({
    queryKey: queryKeys.user.points(),
    queryFn: () => fetchMyPoints(),
  });
}
