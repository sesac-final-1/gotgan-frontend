import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { updateMe } from '@/features/user/api/userApi';

// 내 정보 수정 — 담당 이경석. 응답(수정 후 내 정보)을 캐시에 바로 넣어 마이페이지 상단 · 회원정보가 같이 바뀐다
export function useUpdateMeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request) => updateMe(request),
    onSuccess: (me) => queryClient.setQueryData(queryKeys.user.me(), me),
  });
}
