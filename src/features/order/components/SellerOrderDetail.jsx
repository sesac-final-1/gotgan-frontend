// 판매자 주문 상세 — 담당 이경석 (GET /api/seller/order-items/{orderItemId}). 경로의 lineId = 상품주문 ID
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHead, StatusPill, KV } from '@/shared/components/ui';
import { useSellerOrderItemQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useConfirmOrderItemsMutation, useDeliverOrderItemsMutation, useShipOrderItemsMutation } from '@/features/order/hooks/useSellerDeliveryMutations';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { ITEM_STATUS_LABEL } from '@/features/order/constants';
import { bulkSummary, toShipItems } from '@/features/order/utils/sellerBulk';
import { toDate, trackingOf } from '@/features/order/utils/orderView';
import { toast } from '@/shared/stores/toastStore';
import { won, ymdhm } from '@/shared/utils/format';

const COURIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'];

export default function SellerOrderDetail() {
  const { lineId } = useParams();
  const { data: o, isLoading, isError } = useSellerOrderItemQuery(lineId);
  const { data: store } = useMyStoreQuery();
  const [shipForm, setShipForm] = useState(null); // 송장 입력 중이면 { courier, trackingNo }
  const confirmMutation = useConfirmOrderItemsMutation();
  const shipMutation = useShipOrderItemsMutation();
  const deliverMutation = useDeliverOrderItemsMutation();
  const busy = confirmMutation.isPending || shipMutation.isPending || deliverMutation.isPending;
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (isError || !o) return <p className="text-mute py-10 text-center">주문을 찾을 수 없어요</p>;
  const defaultCourier = store?.courier || COURIERS[0];

  // 단건도 일괄 API — 실패하면 failed[0].message 가 사유
  const run = async (mutation, payload, action) => {
    try {
      const r = await mutation.mutateAsync(payload);
      toast(r.failed.length ? r.failed[0].message : bulkSummary(action, r));
      return !r.failed.length;
    } catch (err) {
      toast(err.response?.data?.message ?? `${action}하지 못했어요. 잠시 후 다시 시도해 주세요.`);
      return false;
    }
  };
  const confirm = () => void run(confirmMutation, [o.orderItemId], '발주확인');
  const deliver = () => void run(deliverMutation, [o.orderItemId], '배송완료 처리');
  const ship = async () => {
    if (await run(shipMutation, toShipItems([o], { [o.orderItemId]: shipForm }, defaultCourier), '발송처리')) setShipForm(null);
  };
  return (
    <div>
      <PageHead crumbs="주문 · 배송 > 주문 관리" title={<span className="num">{o.itemNo}</span>} desc={`주문일시 ${ymdhm(toDate(o.orderedAt))} · 주문번호 ${o.orderNo}`}
        right={<Link to="/seller/orders" className="btn btn-line btn-sm">목록</Link>} />
      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">주문 상품</span><StatusPill s={ITEM_STATUS_LABEL[o.status] ?? o.status} /></div>
            <div className="p-5 flex gap-4">
              <img src={o.thumbnailUrl} alt="" className="w-20 h-24 object-cover bg-cream" />
              <div className="flex-1 text-[13px]">
                <div className="font-semibold text-[15px]">{o.productName}</div>
                <div className="text-mute mt-1">{o.optionName || '단일상품'} · {o.quantity}개</div>
                <div className="mt-2 num">{won(o.unitPrice)} × {o.quantity} = <b>{won(o.itemAmt)}</b></div>
              </div>
            </div>
            <div className="px-5 pb-5 flex flex-wrap gap-2">
              {o.status === 'PAYMENT_DONE' && <button disabled={busy} onClick={confirm} className="btn btn-ink btn-sm">발주확인</button>}
              {o.status === 'PREPARING' && !shipForm && <button onClick={() => setShipForm({ courier: defaultCourier, trackingNo: '' })} className="btn btn-ink btn-sm">송장 입력</button>}
              {o.status === 'SHIPPING' && <button disabled={busy} onClick={deliver} className="btn btn-ink btn-sm">배송완료 처리</button>}
              {['PAYMENT_DONE', 'PREPARING'].includes(o.status) && <button className="btn btn-line btn-sm">판매취소</button>}
              {o.status === 'SHIPPING' && <button className="btn btn-line btn-sm">송장 수정</button>}
              <button className="btn btn-line btn-sm">구매자에게 메시지</button>
            </div>
            {shipForm && (
              <div className="px-5 pb-5 flex flex-wrap items-center gap-2 text-[13px]">
                <select value={shipForm.courier} onChange={(e) => setShipForm({ ...shipForm, courier: e.target.value })} className="field field-sm w-32">{COURIERS.map((c) => <option key={c}>{c}</option>)}</select>
                <input value={shipForm.trackingNo} onChange={(e) => setShipForm({ ...shipForm, trackingNo: e.target.value })} className="field field-sm num w-48" placeholder="송장번호 (비우면 자동)" />
                <button disabled={busy} onClick={() => void ship()} className="btn btn-ink btn-sm">{shipMutation.isPending ? '처리 중…' : '발송처리'}</button>
                <button onClick={() => setShipForm(null)} className="btn btn-ghost btn-sm">취소</button>
              </div>
            )}
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">배송지 정보</span><button className="btn btn-line btn-xs">배송지 수정</button></div>
            <div className="p-5"><KV rows={[['수령인', o.receiverName], ['연락처', o.receiverPhone], ['주소', `(${o.zipcode}) ${o.address1} ${o.address2 ?? ''}`], ['배송메모', o.deliveryMemo || '-'], ['택배사', o.courier || '-'], ['송장번호', o.trackingNo ? <span className="num">{o.trackingNo}</span> : '미등록']]} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">처리 이력</span></div>
            <ol className="p-5">
              {trackingOf(o, o).map((t, i) => (
                <li key={t.what} className="flex gap-4 text-[13px] py-1.5"><span className="num text-mute w-32 shrink-0">{ymdhm(t.at)}</span><span className={i === 0 ? 'font-semibold' : 'text-ink-2'}>{t.what}</span></li>
              ))}
            </ol>
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">구매자</span></div>
            {/* TODO(이경석): 구매자 요약(등급 · 프로필 · 우리 스토어 구매 횟수)은 user 계약이 필요 — 지금은 공개용 이름만 */}
            <div className="p-5 text-[13px]"><b>{o.buyerName}</b></div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">정산 예정</span></div>
            <div className="p-5 text-[13px] space-y-2 num">
              <div className="flex justify-between"><span className="text-ink-2 font-sans">결제금액</span>{won(o.itemAmt)}</div>
              <div className="flex justify-between"><span className="text-ink-2 font-sans">판매수수료 (11%)</span>−{won(o.itemAmt * 0.11)}</div>
              <div className="flex justify-between"><span className="text-ink-2 font-sans">결제수수료 (2.2%)</span>−{won(o.itemAmt * 0.022)}</div>
              <div className="flex justify-between border-t border-line pt-2 font-bold text-[14px]"><span className="font-sans">정산 예정액</span>{won(o.itemAmt * (1 - 0.132))}</div>
              <p className="text-[11.5px] text-mute font-sans">구매확정 후 다음 주 목요일 지급</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
