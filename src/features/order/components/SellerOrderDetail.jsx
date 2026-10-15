// 판매자 주문 상세 — 담당 이경석
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { PageHead, StatusPill, KV, GradeBadge } from '@/shared/components/ui';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useSellerBuyersQuery } from '@/features/order/hooks/useSellerBuyersQuery';
import { trackingOf } from '@/features/order/utils/orderCalc';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { won, ymdhm, maskName } from '@/shared/utils/format';

export default function SellerOrderDetail() {
  const { lineId } = useParams();
  const { data: orders = [], isLoading } = useSellerOrderItemsQuery();
  const { data: products = [] } = useProductsQuery();
  // TODO(이경석): 판매자 주문상세 응답에 구매자 요약(이름 · 닉네임 · 등급 · 프로필 · 우리 스토어 구매 횟수) 포함되면 useSellerBuyersQuery 제거
  const { data: users = [] } = useSellerBuyersQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const userById = useMemo(() => toMap(users), [users]);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  const o = orders.find((x) => x.lineId === lineId);
  if (!o) return <p className="text-mute py-10 text-center">주문을 찾을 수 없어요</p>;
  const p = productById[o.productId];
  const buyer = userById[o.buyerId];
  const amount = o.unitPrice * o.qty;
  // TODO(이경석): useConfirmOrderItemsMutation
  const confirm = () => toast('발주확인 완료');
  // TODO(이경석): useShipOrderItemsMutation
  const ship = () => toast('송장 등록 완료');
  return (
    <div>
      <PageHead crumbs="주문 · 배송 > 주문 관리" title={<span className="num">{o.lineId}</span>} desc={`주문일시 ${ymdhm(o.date)}`}
        right={<Link to="/seller/orders" className="btn btn-line btn-sm">목록</Link>} />
      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">주문 상품</span><StatusPill s={o.status} /></div>
            <div className="p-5 flex gap-4">
              <img src={p?.images[0]} alt="" className="w-20 h-24 object-cover" />
              <div className="flex-1 text-[13px]">
                <div className="font-semibold text-[15px]">{p?.name}</div>
                <div className="text-mute mt-1">{o.option} · {o.qty}개</div>
                <div className="mt-2 num">{won(o.unitPrice)} × {o.qty} = <b>{won(amount)}</b></div>
              </div>
            </div>
            <div className="px-5 pb-5 flex flex-wrap gap-2">
              {o.status === '결제완료' && <button onClick={confirm} className="btn btn-ink btn-sm">발주확인</button>}
              {o.status === '배송준비' && <button onClick={ship} className="btn btn-ink btn-sm">송장 입력</button>}
              {['결제완료', '배송준비'].includes(o.status) && <button className="btn btn-line btn-sm">판매취소</button>}
              {o.status === '배송중' && <button className="btn btn-line btn-sm">송장 수정</button>}
              <button className="btn btn-line btn-sm">구매자에게 메시지</button>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">배송지 정보</span><button className="btn btn-line btn-xs">배송지 수정</button></div>
            <div className="p-5"><KV rows={[['수령인', o.receiver], ['연락처', o.phone], ['주소', o.addr], ['배송메모', o.memo || '-'], ['택배사', o.courier], ['송장번호', o.invoice ? <span className="num">{o.invoice}</span> : '미등록']]} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">처리 이력</span></div>
            <ol className="p-5">
              {trackingOf(o).map((t, i) => (
                <li key={i} className="flex gap-4 text-[13px] py-1.5"><span className="num text-mute w-32 shrink-0">{ymdhm(t.t)}</span><span className={i === 0 ? 'font-semibold' : 'text-ink-2'}>{t.what}</span></li>
              ))}
            </ol>
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">구매자</span></div>
            <div className="p-5 text-[13px] space-y-1.5">
              {buyer ? (
                <div className="flex items-center gap-2.5"><img src={buyer.avatar} alt="" className="w-9 h-9 rounded-full object-cover" /><div><b>{buyer.name}</b> <span className="text-mute">({maskName(buyer.nick)})</span><div className="text-[12px] text-mute flex items-center gap-1.5 mt-0.5"><GradeBadge grade={buyer.grade} /> 우리 스토어 구매 {buyer.orders % 7 + 1}회</div></div></div>
              ) : <b>{o.receiver}</b>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">정산 예정</span></div>
            <div className="p-5 text-[13px] space-y-2 num">
              <div className="flex justify-between"><span className="text-ink-2 font-sans">결제금액</span>{won(amount)}</div>
              <div className="flex justify-between"><span className="text-ink-2 font-sans">판매수수료 (11%)</span>−{won(amount * 0.11)}</div>
              <div className="flex justify-between"><span className="text-ink-2 font-sans">결제수수료 (2.2%)</span>−{won(amount * 0.022)}</div>
              <div className="flex justify-between border-t border-line pt-2 font-bold text-[14px]"><span className="font-sans">정산 예정액</span>{won(amount * (1 - 0.132))}</div>
              <p className="text-[11.5px] text-mute font-sans">구매확정 후 다음 주 목요일 지급</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
