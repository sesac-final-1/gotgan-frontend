import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { createReview, deleteReview, updateReview, uploadReviewImages } from '@/features/review/api/reviewApi';

// 리뷰 작성 · 수정 · 삭제 — 담당 이경석. 성공하면 내가 쓴 리뷰 · 작성 가능 목록을 함께 다시 불러온다
function useReviewMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.review.my() }),
  });
}

// 새 사진(File[])은 먼저 S3 에 올리고, 남길 기존 사진 키(keepKeys) 뒤에 붙여 보낸다
async function withImages({ keepKeys = [], newFiles = [], ...request }) {
  return { ...request, imageKeys: [...keepKeys, ...(await uploadReviewImages(newFiles))] };
}

export const useCreateReviewMutation = () => useReviewMutation(async (form) => createReview(await withImages(form)));
export const useUpdateReviewMutation = () =>
  useReviewMutation(async ({ id, ...form }) => updateReview(id, await withImages(form)));
export const useDeleteReviewMutation = () => useReviewMutation((id) => deleteReview(id));
