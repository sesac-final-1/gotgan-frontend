// 결제 확인 — 담당 구지훈 (엔드포인트는 order, backend #87)
import { axiosInstance } from '@/shared/api/axiosInstance';

// POST /api/orders/{orderNo}/payment/confirm — 주문 Saga 6 · 7단계. 브라우저는 주문번호만 보내고 서버가 포트원에 직접 조회.
// 이미 PAID 면 같은 응답이라 새로고침 · 재전송 안전 → { orderNo, status: 'PAID', payAmt }
export const confirmOrderPayment = async (orderNo) =>
  (await axiosInstance.post(`/api/orders/${encodeURIComponent(orderNo)}/payment/confirm`)).data.data;
