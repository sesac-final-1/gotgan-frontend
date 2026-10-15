import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerBuyers } from '@/features/order/api/orderApi';

// 판매자 화면의 구매자 · 작성자 정보 (임시) — 담당 이경석. 판매자 화면은 /api/admin 을 부르지 않는다 (컨벤션 4-2 규칙 1)
// 리뷰 · 문의 · 주문상세 응답에 작성자명 · 구매자 요약이 들어오면 이 훅을 지우고 응답 필드를 쓴다
export function useSellerBuyersQuery() {
  return useQuery({
    queryKey: queryKeys.order.sellerBuyers(),
    queryFn: () => fetchSellerBuyers(),
  });
}
