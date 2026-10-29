import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import {
  answerInquiry, createInquiry, deleteInquiry, fetchMyInquiries, fetchProductInquiries, fetchSellerInquiries,
  fetchSellerInquirySummary, updateInquiry,
} from '@/features/review/api/inquiryApi';

// 상품 문의 — 담당 이경석. 목록은 서버 페이징 (컨벤션 4-7)
export const INQUIRY_PAGE_SIZE = 10;

// 상품 상세 Q&A — 탭 숫자(첫 페이지 totalElements)와 목록이 같은 키를 쓰도록 params 를 여기서 만든다
export function useProductInquiriesQuery(productId, page = 0) {
  const params = { productId, page, size: INQUIRY_PAGE_SIZE };
  return useQuery({
    queryKey: queryKeys.review.productInquiries(params),
    queryFn: () => fetchProductInquiries(params),
    placeholderData: keepPreviousData,
  });
}

export function useMyInquiriesQuery(page = 0) {
  const params = { page, size: INQUIRY_PAGE_SIZE };
  return useQuery({
    queryKey: queryKeys.review.myInquiries(params),
    queryFn: () => fetchMyInquiries(params),
    placeholderData: keepPreviousData,
  });
}

// 판매자 — params: { tab, page, size }
export function useSellerInquiriesQuery(params) {
  return useQuery({
    queryKey: queryKeys.review.sellerInquiries(params),
    queryFn: () => fetchSellerInquiries(params),
    placeholderData: keepPreviousData,
  });
}

// 판매자 탭 숫자 · 메뉴 배지 — { unanswered, answered, all }
export function useSellerInquirySummaryQuery() {
  return useQuery({
    queryKey: queryKeys.review.sellerInquirySummary(),
    queryFn: () => fetchSellerInquirySummary(),
  });
}

// 변경은 모두 문의 키 전체를 무효화 — 상품 Q&A · 내 문의 · 판매자 목록 · 숫자가 함께 갱신
function useInquiryMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.review.inquiry() }),
  });
}

// mutate({ productId, content, secret })
export const useCreateInquiryMutation = () => useInquiryMutation((request) => createInquiry(request));
// mutate({ id, content, secret })
export const useUpdateInquiryMutation = () => useInquiryMutation(({ id, ...request }) => updateInquiry(id, request));
export const useDeleteInquiryMutation = () => useInquiryMutation((id) => deleteInquiry(id));
// mutate({ id, content })
export const useAnswerInquiryMutation = () => useInquiryMutation(({ id, content }) => answerInquiry(id, content));
