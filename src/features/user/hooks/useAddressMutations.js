import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { createAddress, deleteAddress, markDefaultAddress, updateAddress } from '@/features/user/api/userApi';

// 배송지 변경 — 담당 이경석. 성공하면 목록을 다시 불러온다 (기본 배송지가 바뀌면 다른 카드도 바뀌므로 캐시를 직접 고치지 않음)
function useAddressMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.addresses() }),
  });
}

export const useCreateAddressMutation = () => useAddressMutation((request) => createAddress(request));
export const useUpdateAddressMutation = () => useAddressMutation(({ id, request }) => updateAddress(id, request));
export const useDeleteAddressMutation = () => useAddressMutation((id) => deleteAddress(id));
export const useSetDefaultAddressMutation = () => useAddressMutation((id) => markDefaultAddress(id));
