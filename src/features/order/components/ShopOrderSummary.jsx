// 장바구니 · 주문서 공통 — 결제 금액 요약 박스 + 스토어별 묶음 계산 — 담당 이경석
import { shipFeeFor } from '@/features/order/utils/orderCalc';
import { earnOf, POINT_RATE } from '@/features/user/constants';
import { won, comma } from '@/shared/utils/format';

/* 스토어별로 묶어서 배송비 계산 (스마트스토어 방식: 같은 스토어 상품은 묶음배송) */
// eslint-disable-next-line react-refresh/only-export-components
export function groupByStore(lines, storeById) {
  const g = {};
  lines.forEach((l) => { (g[l.product.storeId] ||= []).push(l); });
  return Object.entries(g).filter(([sid]) => storeById[sid]).map(([sid, ls]) => {
    const store = storeById[sid];
    const subtotal = ls.reduce((a, l) => a + l.unit * l.qty, 0);
    return { store, lines: ls, subtotal, ship: shipFeeFor(store, subtotal) };
  });
}

/* 실결제금액 = 상품금액(할인 반영) + 배송비 − 사용 포인트 / 적립 = 실결제금액의 5% */
// eslint-disable-next-line react-refresh/only-export-components
export const totalsOf = (groups, point = 0) => {
  const list = groups.reduce((a, g) => a + g.lines.reduce((b, l) => b + l.product.price * l.qty, 0), 0);
  const sale = groups.reduce((a, g) => a + g.subtotal, 0);
  const ship = groups.reduce((a, g) => a + g.ship, 0);
  const pay = Math.max(0, sale + ship - point);
  return { list, sale, ship, pay, earn: earnOf(pay) };
};

export default function ShopOrderSummary({ groups, point = 0, cta, label = '결제 예정금액' }) {
  const t = totalsOf(groups, point);
  return (
    <div className="border border-ink">
      <div className="p-5 space-y-2.5 text-[14px]">
        <div className="flex justify-between"><span className="text-ink-2">상품금액</span><span className="num">{won(t.list)}</span></div>
        <div className="flex justify-between"><span className="text-ink-2">상품할인</span><span className="num text-point">−{won(t.list - t.sale)}</span></div>
        <div className="flex justify-between"><span className="text-ink-2">배송비</span><span className="num">{t.ship ? `+${won(t.ship)}` : '무료'}</span></div>
        {point > 0 && <div className="flex justify-between"><span className="text-ink-2">포인트 사용</span><span className="num text-point">−{comma(point)}P</span></div>}
      </div>
      <div className="px-5 py-4 border-t border-line flex justify-between items-baseline">
        <span className="font-bold">{label}</span>
        <span className="text-[24px] font-bold num">{won(t.pay)}</span>
      </div>
      <div className="px-5 pb-5">{cta(t.pay, t.earn)}</div>
      <p className="px-5 pb-4 -mt-2 text-[11.5px] text-mute">결제 시 실결제금액의 {POINT_RATE * 100}% <b className="num text-ink">{comma(t.earn)}P</b> 적립 예정</p>
    </div>
  );
}
