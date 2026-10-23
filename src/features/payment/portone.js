// 포트원 결제창 — 담당 구지훈. 토스페이먼츠 V2 테스트 채널 · 카드만 (backend docs/api/payment.md 결정 11)
import * as PortOne from '@portone/browser-sdk/v2';

// 사용자가 결제창을 닫음 — PG 가 주는 코드 (토스페이먼츠 PAY_PROCESS_CANCELED)
const CANCEL_PG_CODES = new Set(['PAY_PROCESS_CANCELED', 'USER_CANCEL']);

// 결제창 응답 · 리다이렉트 쿼리 → { status: 'APPROVED' | 'CANCELLED' | 'FAILED', message }.
// APPROVED 는 "결제창이 끝났다"일 뿐 — 실제 결제 여부 · 금액은 서버가 포트원에 다시 물어 확정한다 (결제 확인 API)
export function toPaymentResult(r) {
  if (!r.code) return { status: 'APPROVED', message: '' };
  if (CANCEL_PG_CODES.has(r.pgCode)) return { status: 'CANCELLED', message: '결제를 취소했어요.' };
  return { status: 'FAILED', message: r.pgMessage || r.message || '결제에 실패했어요.' };
}

// paymentId 는 order 가 주는 portonePaymentId(pay-{orderNo}) — 금액 · 주문명도 주문 생성 응답 그대로 (서버 계산값).
// 모바일처럼 결제사 페이지로 이동하는 경우 SDK 가 undefined 를 주고 redirectUrl 로 돌아온다 → null
export async function requestCardPayment({ portonePaymentId, payAmt, orderName, redirectUrl }) {
  try {
    const response = await PortOne.requestPayment({
      storeId: import.meta.env.VITE_PORTONE_STORE_ID,
      channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY,
      paymentId: portonePaymentId,
      orderName,
      totalAmount: payAmt,
      currency: 'KRW',
      payMethod: 'CARD',
      redirectUrl,
    });
    return response ? toPaymentResult(response) : null;
  } catch {
    // 결제창을 띄우기 전 오류 (SDK 로드 실패 · 잘못된 요청) — 결제는 시작되지 않음
    return { status: 'FAILED', message: '결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

// redirectUrl 로 돌아온 쿼리(?paymentId · code · message · pgCode · pgMessage) → 결과. 결제 결과 쿼리가 아니면 null
export function readPaymentRedirect(search) {
  const query = new URLSearchParams(search);
  return query.get('paymentId') ? toPaymentResult(Object.fromEntries(query)) : null;
}
