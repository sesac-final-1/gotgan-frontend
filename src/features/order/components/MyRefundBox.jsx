// 클레임 환불 예정 금액 박스 (클레임 신청 · 클레임 내역 공용) — 담당 이경석
import { linePoints } from '@/features/order/utils/orderCalc';
import { cx, won, comma } from '@/shared/utils/format';

export const SELLER_FAULT = ['상품 불량/파손', '오배송', '상품정보와 다름'];

/* 환불 계산: 결제수단 환불 = 상품금액 − 그 상품주문분 사용 포인트 − 반품 배송비 / 사용 포인트는 환원, 적립 포인트는 회수 */
function refundOf(o, l, type, reason, store) {
  const amount = l.unitPrice * l.qty;
  const lp = linePoints(o, l);
  const shipFee = store?.shipFee || 3000;
  const fee = type === '취소' || SELLER_FAULT.includes(reason) ? 0 : shipFee * 2;
  if (type === '교환') return { amount, fee, cash: 0, pointBack: 0, pointTake: 0 };
  return { amount, fee, cash: Math.max(0, amount - lp.used - fee), pointBack: lp.used, pointTake: lp.earned };
}

// order · line: 주문 · 상품주문 / store: 상품의 스토어(반품 배송비) / type: 취소 · 반품 · 교환
export default function MyRefundBox({ order, line, type, reason, store }) {
  const r = refundOf(order, line, type, reason, store);
  const row = (k, v, cls = '') => <div className={cx('flex justify-between', cls)}><span className="text-ink-2">{k}</span><span className="num">{v}</span></div>;
  return (
    <div className="bg-cream p-5 text-[14px] space-y-2">
      {row('상품 금액', won(r.amount))}
      {type === '교환'
        ? row('교환 배송비 (왕복)', r.fee ? won(r.fee) : '판매자 부담')
        : <>
          {row(type === '취소' ? '취소 배송비' : '반품 배송비 차감', r.fee ? `−${won(r.fee)}` : '판매자 부담')}
          {row('사용 포인트 환원', r.pointBack ? `+${comma(r.pointBack)}P` : '0P', 'text-moss')}
          {row('적립 포인트 회수', r.pointTake ? `−${comma(r.pointTake)}P` : '0P', 'text-rust')}
          <div className="flex justify-between font-bold border-t border-line-2 pt-2"><span>결제수단 환불 예정 금액</span><span className="num">{won(r.cash)}</span></div>
        </>}
    </div>
  );
}
