// 마이페이지 주문 상세 — 담당 이경석 (GET /api/orders/{orderNo})
import { Link, useParams } from 'react-router';
import { StatusPill } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyOrderQuery } from '@/features/order/hooks/useMyOrderQuery';
import OpenChatButton from '@/features/chat/components/OpenChatButton';
import { lineStatusLabel, payMethodLabel, toDate, trackingOf } from '@/features/order/utils/orderView';
import { cx, won, comma, ymdhm } from '@/shared/utils/format';

export default function MyOrderDetail() {
  const { id } = useParams(); // 주문번호
  const { data: o, isLoading, isError } = useMyOrderQuery(id);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (isError || !o) return <p className="text-mute py-10 text-center">주문을 찾을 수 없어요</p>;
  const shipped = o.items.find((l) => l.trackingNo) || o.items[0];
  return (
    <div>
      <MyPageHead right={<Link to="/mypage/orders" className="text-[13px] text-ink-2">← 목록</Link>}>주문 상세</MyPageHead>
      <div className="text-[13px] text-ink-2 mb-4"><b className="text-ink">{ymdhm(toDate(o.orderedAt))}</b> 주문 · <span className="num">{o.orderNo}</span></div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div className="border border-line">
          {o.items.map((l) => (
            <div key={l.orderItemId} className="flex gap-4 p-4 border-b border-line last:border-0 text-[13px]">
              <img src={l.thumbnailUrl} alt="" className="w-16 h-20 object-cover bg-cream" />
              <div className="flex-1"><StatusPill s={lineStatusLabel(o, l)} /><div className="font-medium text-[14px] mt-1.5">{l.productName}</div><div className="text-mute">{l.storeName} · {l.optionName || '단일상품'} · {l.quantity}개</div></div>
              <div className="flex flex-col items-end justify-between">
                <div className="font-bold num">{won(l.itemAmt)}</div>
                <OpenChatButton className="btn btn-line btn-xs" basePath="/mypage/chats"
                  request={{ type: 'STORE_INQUIRY', storeId: l.storeId, context: { type: 'ORDER_ITEM', id: l.orderItemId } }}>
                  판매자 문의
                </OpenChatButton>
              </div>
            </div>
          ))}
        </div>
        <div className="border border-line p-5">
          <div className="font-bold mb-1">배송 조회</div>
          <div className="text-[12px] text-mute mb-4">{shipped.trackingNo ? <>{shipped.courier} <span className="num">{shipped.trackingNo}</span></> : '송장 등록 전'}</div>
          <ol className="border-l border-line ml-1.5">
            {trackingOf(o, shipped).map((t, i) => (
              <li key={t.what} className="relative pl-5 pb-4 last:pb-0">
                <span className={cx('absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full', i === 0 ? 'bg-point' : 'bg-line-2')} />
                <div className={cx('text-[13px]', i === 0 ? 'font-bold' : 'text-ink-2')}>{t.what}</div>
                <div className="text-[11.5px] text-mute num">{ymdhm(t.at)}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div>
          <div className="font-bold mb-2">배송지</div>
          <div className="border-t border-ink text-[13px]">
            {[['받는 분', o.receiverName], ['연락처', o.receiverPhone], ['주소', `(${o.zipcode}) ${o.address1} ${o.address2 ?? ''}`], ['요청사항', o.deliveryMemo || '없음']].map(([k, v]) => <div key={k} className="flex py-2.5 border-b border-line"><span className="w-24 text-mute">{k}</span>{v}</div>)}
          </div>
        </div>
        <div>
          <div className="font-bold mb-2">결제 정보</div>
          <div className="border-t border-ink text-[13px]">
            {[['상품금액', won(o.totalProductAmt)], ['배송비', o.totalShippingFee ? `+${won(o.totalShippingFee)}` : '무료'], ['포인트 사용', o.usedPoint ? `−${comma(o.usedPoint)}P` : '0P'], ['결제수단', payMethodLabel(o.payment)]].map(([k, v]) => <div key={k} className="flex justify-between py-2.5 border-b border-line"><span className="text-mute">{k}</span><span className="num">{v}</span></div>)}
            <div className="flex justify-between py-3 font-bold border-b border-line"><span>실결제금액</span><span className="num text-[16px]">{won(o.payAmt)}</span></div>
            {o.payment?.cancelledAmount > 0 && <div className="flex justify-between py-2.5 border-b border-line text-rust"><span>환불 금액</span><span className="num">−{won(o.payment.cancelledAmount)}</span></div>}
            <div className="flex justify-between py-2.5 text-[13px]"><span className="text-mute">{o.items.every((l) => l.status === 'CONFIRMED') ? '적립 포인트' : '적립 예정 포인트 (구매확정 시 적립)'}</span><span className="num font-semibold text-moss">+{comma(o.earnedPoint)}P</span></div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-line btn-sm">영수증 / 거래명세서</button>
            {/* 주문 카드 id = 주문번호의 숫자 (20261027-000001 → 20261027000001, chat.md 문맥 카드) */}
            <OpenChatButton basePath="/mypage/chats" request={{ type: 'BUYER_SUPPORT', context: { type: 'ORDER', id: Number(o.orderNo.replace('-', '')) } }}>
              결제 · 환불 문의
            </OpenChatButton>
          </div>
        </div>
      </div>
    </div>
  );
}
