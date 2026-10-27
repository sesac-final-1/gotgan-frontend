import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { approveClaim, collectClaim, fetchMyClaims, fetchSellerClaims, rejectClaim, reshipClaim } from '@/features/order/api/orderApi';

// 내 클레임 내역 — 담당 이경석 (GET /api/claims, 전체 1회 로드)
export function useMyClaimsQuery() {
  return useQuery({ queryKey: queryKeys.order.myClaims(), queryFn: () => fetchMyClaims() });
}

// 판매자 클레임 { stageCounts, typeCounts, items } — params: { stage, type, page, size } (서버 페이징)
export function useSellerClaimsQuery(params) {
  return useQuery({
    queryKey: queryKeys.order.sellerClaims(params),
    queryFn: () => fetchSellerClaims(params),
    placeholderData: keepPreviousData,
  });
}

// 판매자 클레임 처리 — 끝나면 판매자 클레임 · 주문 목록(상품주문 상태가 바뀜) · 탭 숫자를 다시 불러온다
function useClaimMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.order.seller() }),
  });
}

export const useApproveClaimMutation = () => useClaimMutation((claimId) => approveClaim(claimId));
export const useRejectClaimMutation = () => useClaimMutation(({ claimId, reason }) => rejectClaim(claimId, reason));
export const useCollectClaimMutation = () => useClaimMutation((claimId) => collectClaim(claimId));
export const useReshipClaimMutation = () => useClaimMutation(({ claimId, courier, trackingNo }) => reshipClaim(claimId, { courier, trackingNo }));
