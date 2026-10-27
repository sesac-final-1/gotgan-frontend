// 장바구니 · 주문서 공통 — 결제 금액 요약 박스 — 담당 이경석
// 상품금액 · 배송비는 서버 장바구니 응답(선택된 구매 가능 줄 기준, 스토어별 묶음배송)을 그대로 받는다
import { earnOf, POINT_RATE } from '@/features/user/constants';
import { won, comma } from '@/shared/utils/format';

/* 실결제금액 = 상품금액 + 배송비 − 사용 포인트 / 적립 = 실결제금액의 5%, 구매확정 때 (안내용 — 확정 금액은 주문 생성 응답) */
export default function ShopOrderSummary({ productAmt, shippingFee, point = 0, cta, label = '결제 예정금액' }) {
  const pay = Math.max(0, productAmt + shippingFee - point);
  const earn = earnOf(pay);
  return (
    <div className="border border-ink">
      <div className="p-5 space-y-2.5 text-[14px]">
        <div className="flex justify-between"><span className="text-ink-2">상품금액</span><span className="num">{won(productAmt)}</span></div>
        <div className="flex justify-between"><span className="text-ink-2">배송비</span><span className="num">{shippingFee ? `+${won(shippingFee)}` : '무료'}</span></div>
        {point > 0 && <div className="flex justify-between"><span className="text-ink-2">포인트 사용</span><span className="num text-point">−{comma(point)}P</span></div>}
      </div>
      <div className="px-5 py-4 border-t border-line flex justify-between items-baseline">
        <span className="font-bold">{label}</span>
        <span className="text-[24px] font-bold num">{won(pay)}</span>
      </div>
      <div className="px-5 pb-5">{cta(pay, earn)}</div>
      <p className="px-5 pb-4 -mt-2 text-[11.5px] text-mute">구매확정 시 실결제금액의 {POINT_RATE * 100}% <b className="num text-ink">{comma(earn)}P</b> 적립 예정</p>
    </div>
  );
}
