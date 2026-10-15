// 마이페이지 주문 상세 — 담당 이경석
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { StatusPill } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import { trackingOf, orderPay } from '@/features/order/utils/orderCalc';
import { POINT_RATE } from '@/features/user/constants';
import { toMap } from '@/shared/utils/collection';
import { cx, won, comma, ymdhm } from '@/shared/utils/format';

export default function MyOrderDetail() {
  const { id } = useParams();
  const { data: orders = [], isLoading } = useMyOrdersQuery();
  const { data: products = [], isLoading: productsLoading } = useProductsQuery();
  const { data: addresses = [] } = useMyAddressesQuery();
  const productById = useMemo(() => toMap(products), [products]);
  if (isLoading || productsLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  const o = orders.find((x) => x.id === id);
  if (!o) return <p className="text-mute py-10 text-center">주문을 찾을 수 없어요</p>;
  const shipped = o.items.find((l) => l.invoice) || o.items[0];
  const pay = orderPay(o);
  const addr = addresses[0];
  return (
    <div>
      <MyPageHead right={<Link to="/mypage/orders" className="text-[13px] text-ink-2">← 목록</Link>}>주문 상세</MyPageHead>
      <div className="text-[13px] text-ink-2 mb-4"><b className="text-ink">{ymdhm(o.date)}</b> 주문 · <span className="num">{o.id}</span></div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div className="border border-line">
          {o.items.map((l) => {
            const p = productById[l.productId];
            if (!p) return null;
            return (
              <div key={l.lineId} className="flex gap-4 p-4 border-b border-line last:border-0 text-[13px]">
                <img src={p.images[0]} alt="" className="w-16 h-20 object-cover" />
                <div className="flex-1"><StatusPill s={l.status} /><div className="font-medium text-[14px] mt-1.5">{p.name}</div><div className="text-mute">{l.option} · {l.qty}개</div></div>
                <div className="font-bold num">{won(l.unitPrice * l.qty)}</div>
              </div>
            );
          })}
        </div>
        <div className="border border-line p-5">
          <div className="font-bold mb-1">배송 조회</div>
          <div className="text-[12px] text-mute mb-4">{shipped.courier} {shipped.invoice ? <span className="num">{shipped.invoice}</span> : '· 송장 등록 전'}</div>
          <ol className="border-l border-line ml-1.5">
            {trackingOf(shipped).map((t, i) => (
              <li key={i} className="relative pl-5 pb-4 last:pb-0">
                <span className={cx('absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full', i === 0 ? 'bg-point' : 'bg-line-2')} />
                <div className={cx('text-[13px]', i === 0 ? 'font-bold' : 'text-ink-2')}>{t.what}</div>
                <div className="text-[11.5px] text-mute num">{ymdhm(t.t)} · {t.where}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div>
          <div className="font-bold mb-2">배송지</div>
          <div className="border-t border-ink text-[13px]">
            {addr && [['받는 분', addr.name], ['연락처', addr.phone], ['주소', `${addr.addr} ${addr.detail}`], ['요청사항', '문 앞에 놓아주세요']].map(([k, v]) => <div key={k} className="flex py-2.5 border-b border-line"><span className="w-24 text-mute">{k}</span>{v}</div>)}
          </div>
        </div>
        <div>
          <div className="font-bold mb-2">결제 정보</div>
          <div className="border-t border-ink text-[13px]">
            {[['상품금액', won(pay.goods)], ['배송비', pay.ship ? `+${won(pay.ship)}` : '무료'], ['포인트 사용', pay.used ? `−${comma(pay.used)}P` : '0P'], ['결제수단', `${o.payment.method} · ${o.payment.detail}`]].map(([k, v]) => <div key={k} className="flex justify-between py-2.5 border-b border-line"><span className="text-mute">{k}</span><span className="num">{v}</span></div>)}
            <div className="flex justify-between py-3 font-bold border-b border-line"><span>실결제금액</span><span className="num text-[16px]">{won(pay.paid)}</span></div>
            <div className="flex justify-between py-2.5 text-[13px]"><span className="text-mute">적립 포인트 (실결제금액의 {POINT_RATE * 100}%)</span><span className="num font-semibold text-moss">+{comma(pay.earned)}P</span></div>
          </div>
          <button className="btn btn-line btn-sm mt-2">영수증 / 거래명세서</button>
        </div>
      </div>
    </div>
  );
}
