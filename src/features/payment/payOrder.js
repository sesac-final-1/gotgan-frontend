// 결제 흐름 — 담당 구지훈. 주문 생성 응답 → 결제창 → 결제 확인. 결과는 던지지 않고 status 로 돌려준다:
//   PAID(결제 완료) · CANCELLED(결제창 닫음) · FAILED(결제 실패 · 주문 취소) · PENDING(결과 모름) · REDIRECTED(결제사 페이지로 이동)
// CANCELLED · 결제창 FAILED · PENDING 은 주문이 결제 대기로 남는다 — 15분 뒤 서버가 확정하거나 재고 · 포인트를 되돌린다 (ORD-07)
import { confirmOrderPayment } from '@/features/payment/api/paymentApi';
import { readPaymentRedirect, requestCardPayment } from '@/features/payment/portone';

// 모바일 리다이렉트로 돌아올 곳 — 주문 완료 화면이 쿼리로 결과를 읽어 결제 확인을 이어서 부른다
export const paymentRedirectUrl = (orderNo) =>
  `${window.location.origin}/order/complete?orderNo=${encodeURIComponent(orderNo)}`;

const PENDING_MESSAGE = '결제가 아직 확인되지 않았어요. 잠시 후 주문 내역에서 확인해 주세요.';
const FAILED_MESSAGES = {
  ORDER_PAYMENT_FAILED: '결제를 확인하지 못해 주문이 취소되었어요. 결제된 금액은 자동으로 취소돼요.',
};

async function confirm(orderNo) {
  try {
    const { payAmt } = await confirmOrderPayment(orderNo);
    return { status: 'PAID', orderNo, payAmt, message: '' };
  } catch (err) {
    const res = err.response;
    // 409 미결제 · 5xx · 네트워크 오류 = 결과 모름 → 주문은 결제 대기 그대로
    if (!res || res.status >= 500 || res.data?.code === 'ORDER_PAYMENT_NOT_COMPLETED') {
      return { status: 'PENDING', orderNo, message: PENDING_MESSAGE };
    }
    return { status: 'FAILED', orderNo, message: FAILED_MESSAGES[res.data?.code] ?? res.data?.message ?? '결제에 실패했어요.' };
  }
}

// created = 주문 생성 응답 { orderNo, status, payAmt, portonePaymentId, orderName }
export async function payOrder(created) {
  const { orderNo } = created;
  if (created.payAmt === 0) return { status: 'PAID', orderNo, payAmt: 0, message: '' }; // 전액 포인트 — 주문 생성 때 이미 PAID, 결제창 없음
  const result = await requestCardPayment({ ...created, redirectUrl: paymentRedirectUrl(orderNo) });
  if (!result) return { status: 'REDIRECTED', orderNo, message: '' };
  if (result.status !== 'APPROVED') return { ...result, orderNo };
  return confirm(orderNo);
}

// 리다이렉트로 돌아온 주문 완료 화면 — 쿼리에 결제 결과가 없으면 null (PC 결제는 주문서에서 이미 확인)
export async function finishRedirectPayment(orderNo, search) {
  const result = readPaymentRedirect(search);
  if (!result) return null;
  if (result.status !== 'APPROVED') return { ...result, orderNo };
  return confirm(orderNo);
}
