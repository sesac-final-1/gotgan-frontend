import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { confirmPurchase, fetchClaimPreview, requestClaim, withdrawClaim } from '@/features/order/api/orderApi';

// 클레임 환불 예정액 — 담당 이경석. 사유를 고르기 전에는 부르지 않는다. 신청 불가(409)는 isError + 서버 메시지
export function useClaimPreviewQuery(orderNo, { orderItemId, type, reasonCode }) {
  const params = { orderItemId, type, reasonCode };
  return useQuery({
    queryKey: queryKeys.order.claimPreview(orderNo, params),
    queryFn: () => fetchClaimPreview(orderNo, params),
    enabled: Boolean(orderNo && orderItemId && type && reasonCode),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

// 클레임 신청 — 담당 이경석. 취소는 포인트가 환원 · 회수되므로 포인트도 다시 불러온다 (주문 목록 · 상세 · 예정액은 order.my() 아래)
export function useRequestClaimMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderNo, request }) => requestClaim(orderNo, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.order.my() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.points() });
    },
  });
}

// 클레임 철회 — 담당 이경석. 내 주문 · 상세 · 클레임 내역(모두 order.my() 아래)을 다시 불러온다
function useMyOrderMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.order.my() }),
  });
}

// 구매확정 — 적립 포인트(user) · 리뷰 자격(review)은 이벤트로 1초쯤 늦게 생기므로 잠깐 뒤 두 번 더 불러온다
const EVENT_LAG_MS = [1500, 4000];
export function useConfirmPurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderNo, orderItemId }) => confirmPurchase(orderNo, orderItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.order.my() });
      EVENT_LAG_MS.forEach((ms) => setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.review.my() });
      }, ms));
    },
  });
}
export const useWithdrawClaimMutation = () => useMyOrderMutation((claimId) => withdrawClaim(claimId));
