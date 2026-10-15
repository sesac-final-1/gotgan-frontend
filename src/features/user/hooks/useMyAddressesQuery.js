import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchMyAddresses } from '@/features/user/api/userApi';

// 배송지 — 담당 이경석. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useMyAddressesQuery() {
  return useQuery({
    queryKey: queryKeys.user.addresses(),
    queryFn: () => fetchMyAddresses(),
  });
}
