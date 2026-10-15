import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchQnas } from '@/features/review/api/reviewApi';

// 상품 문의 — 담당 이경석. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useQnasQuery() {
  return useQuery({
    queryKey: queryKeys.review.qnas(),
    queryFn: () => fetchQnas(),
  });
}
