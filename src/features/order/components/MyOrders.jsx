// 마이페이지 주문 · 배송 — 담당 이경석 (GET /api/orders). 주문 카드 목록(표 아님)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { StatusPill } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { flowCounts, lineStatusLabel, toDate } from '@/features/order/utils/orderView';
import { toast } from '@/shared/stores/toastStore';
import { cx, won, ymd } from '@/shared/utils/format';

// 클레임 신청 경로의 lineId = 상품주문번호(itemNo)
const claimPath = (l, type) => `/mypage/claim/${l.itemNo}?type=${type}`;

function LineActions({ o, l }) {
  const nav = useNavigate();
  const b = 'btn btn-line btn-xs';
  // TODO(이경석): useConfirmPurchaseMutation · useWithdrawClaimMutation (아래 토스트 버튼들) · 배송준비 취소요청(CLM-02)
  if (o.status !== 'PAID') return null; // 결제 대기 · 실패 주문은 할 일 없음 (대기는 서버가 정리)
  switch (l.status) {
    case 'PAYMENT_DONE': return <button className={b} onClick={() => nav(claimPath(l, 'CANCEL'))}>주문취소</button>;
    case 'SHIPPING': return <Link className={b} to={`/mypage/orders/${o.orderNo}`}>배송조회</Link>;
    case 'DELIVERED': return (<>
      <button className="btn btn-ink btn-xs" onClick={() => toast('구매확정 되었어요. 리뷰를 작성할 수 있어요')}>구매확정</button>
      <button className={b} onClick={() => nav(claimPath(l, 'RETURN'))}>반품요청</button>
      <button className={b} onClick={() => nav(claimPath(l, 'EXCHANGE'))}>교환요청</button>
    </>);
    case 'CONFIRMED': return <Link className="btn btn-point btn-xs" to="/mypage/reviews">리뷰쓰기</Link>; // TODO(이경석): 리뷰 API — 작성 여부 · 작성 모달
    case 'RETURN_REQUESTED': return <button className={b} onClick={() => toast('반품 요청을 철회했어요')}>반품철회</button>;
    case 'EXCHANGE_REQUESTED': return <button className={b} onClick={() => toast('교환 요청을 철회했어요')}>교환철회</button>;
    default: return null;
  }
}

// 결제 대기 · 실패 안내 — 결제 대기 만료(ORD-07)는 서버 스케줄러가 처리하고 화면은 상태만 보여 준다
function OrderNotice({ status }) {
  if (status === 'PENDING') return <div className="px-4 py-2.5 text-[12px] bg-cream border-b border-line text-ink-2">결제가 아직 확인되지 않았어요. 결제를 마치지 않으면 잠시 후 주문이 자동 취소되고 사용한 포인트는 돌려드려요.</div>;
  if (status === 'FAILED') return <div className="px-4 py-2.5 text-[12px] bg-cream border-b border-line text-rust">결제 시간이 지났거나 결제가 확인되지 않아 주문이 취소되었어요. 사용한 포인트는 돌려드렸어요.</div>;
  return null;
}

export default function MyOrders() {
  const [period, setPeriod] = useState('3개월');
  const { data, isLoading, isError } = useMyOrdersQuery();
  const orders = data?.orders ?? [];
  const counts = flowCounts(data?.statusCounts);
  return (
    <div>
      <MyPageHead>주문 · 배송</MyPageHead>
      <div className="grid grid-cols-5 border border-line">
        {counts.map(([s, n], i) => (
          <div key={s} className={cx('py-5 text-center relative', i && 'border-l border-line')}>
            <div className={cx('text-[24px] font-bold num', n ? 'text-ink' : 'text-line-2')}>{n}</div>
            <div className="text-[12px] text-ink-2 mt-1">{s}</div>
            {i < 4 && <ChevronRight size={14} className="absolute -right-[8px] top-1/2 -translate-y-1/2 bg-white text-mute hidden sm:block" />}
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-6 mb-4">
        {['1개월', '3개월', '6개월', '전체'].map((p) => <button key={p} onClick={() => setPeriod(p)} className={cx('h-8 px-3 text-[13px] border', period === p ? 'border-ink bg-ink text-white' : 'border-line-2 text-ink-2')}>{p}</button>)}
      </div>
      {isLoading && <p className="text-mute py-10 text-center">불러오는 중…</p>}
      {isError && <p className="text-mute py-10 text-center">주문 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      {!isLoading && !isError && !orders.length && <p className="text-mute py-10 text-center">주문 내역이 없어요</p>}
      <div className="space-y-5">
        {orders.map((o) => (
          <div key={o.orderNo} className="border border-line">
            <div className="flex items-center justify-between px-4 h-11 bg-cream border-b border-line text-[13px]">
              <span><b>{ymd(toDate(o.orderedAt))}</b> <span className="text-mute num ml-2">주문번호 {o.orderNo}</span></span>
              <Link to={`/mypage/orders/${o.orderNo}`} className="flex items-center text-ink-2 hover:text-ink">상세보기 <ChevronRight size={14} /></Link>
            </div>
            <OrderNotice status={o.status} />
            {o.items.map((l) => (
              <div key={l.orderItemId} className="flex flex-wrap sm:flex-nowrap gap-4 p-4 border-b border-line last:border-0">
                <Link to={`/products/${l.productId}`}><img src={l.thumbnailUrl} alt="" className="w-20 h-24 object-cover bg-cream" /></Link>
                <div className="flex-1 min-w-0 text-[13px]">
                  <StatusPill s={lineStatusLabel(o, l)} />
                  <div className="mt-1.5 text-mute">{l.storeName}</div>
                  <Link to={`/products/${l.productId}`} className="font-medium text-[14px] hover:underline">{l.productName}</Link>
                  <div className="text-mute mt-0.5">{l.optionName || '단일상품'} · {l.quantity}개 · <b className="text-ink num">{won(l.itemAmt)}</b></div>
                  {l.status === 'DELIVERED' && <div className="text-[12px] text-moss mt-1">{ymd(toDate(l.deliveredAt))} 배송완료 · 7일 뒤 자동 구매확정</div>}
                </div>
                <div className="w-full sm:w-auto flex sm:flex-col gap-1.5 sm:items-stretch sm:min-w-[96px]"><LineActions o={o} l={l} /></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
