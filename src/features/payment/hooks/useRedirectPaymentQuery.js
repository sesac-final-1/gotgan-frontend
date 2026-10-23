import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { finishRedirectPayment } from '@/features/payment/payOrder';

// 모바일 리다이렉트 결과 — 담당 구지훈. 주문 완료 화면: useRedirectPaymentQuery(orderNo, location.search), data null = 리다이렉트 아님.
// 결제 확인은 다시 불러도 같은 결과라 StrictMode 이중 호출 · 새로고침에 안전 — 한 번만 부르도록 재시도 · 갱신은 끈다
export function useRedirectPaymentQuery(orderNo, search) {
  return useQuery({
    queryKey: queryKeys.payment.redirect(orderNo, search),
    queryFn: () => finishRedirectPayment(orderNo, search),
    enabled: Boolean(orderNo),
    retry: false,
    staleTime: Infinity,
  });
}
