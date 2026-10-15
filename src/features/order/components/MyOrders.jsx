// 마이페이지 주문 · 배송 — 담당 이경석. 주문 카드 목록(표 아님)이라 목업 그대로
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { StatusPill } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import MyReviewModal from '@/features/review/components/MyReviewModal';
import { FLOW } from '@/features/order/constants';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { cx, won, ymd } from '@/shared/utils/format';

function LineActions({ l, onReview }) {
  const nav = useNavigate();
  const b = 'btn btn-line btn-xs';
  // TODO(이경석): useConfirmPurchaseMutation · useWithdrawClaimMutation (아래 토스트 버튼들)
  switch (l.status) {
    case '결제완료': return <button className={b} onClick={() => nav(`/mypage/claim/${l.lineId}?type=취소`)}>주문취소</button>;
    case '배송준비': return <button className={b} onClick={() => nav(`/mypage/claim/${l.lineId}?type=취소`)}>취소요청</button>;
    case '배송중': return <Link className={b} to={`/mypage/orders/${l.orderId}`}>배송조회</Link>;
    case '배송완료': return (<>
      <button className="btn btn-ink btn-xs" onClick={() => toast('구매확정 되었어요. 리뷰를 작성할 수 있어요')}>구매확정</button>
      <button className={b} onClick={() => nav(`/mypage/claim/${l.lineId}?type=반품`)}>반품요청</button>
      <button className={b} onClick={() => nav(`/mypage/claim/${l.lineId}?type=교환`)}>교환요청</button>
    </>);
    case '구매확정': return l.reviewed ? <span className="text-[12px] text-mute">리뷰 작성완료</span> : <button className="btn btn-point btn-xs" onClick={() => onReview(l)}>리뷰쓰기</button>;
    case '반품요청': return <button className={b} onClick={() => toast('반품 요청을 철회했어요')}>반품철회</button>;
    case '교환요청': return <button className={b} onClick={() => toast('교환 요청을 철회했어요')}>교환철회</button>;
    case '취소요청': return <button className={b} onClick={() => toast('취소 요청을 철회했어요')}>취소철회</button>;
    default: return null;
  }
}

export default function MyOrders() {
  const [review, setReview] = useState(null);
  const [period, setPeriod] = useState('3개월');
  const { data: orders = [], isLoading } = useMyOrdersQuery();
  const { data: products = [], isLoading: productsLoading } = useProductsQuery();
  const { data: stores = [] } = useStoresQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const storeById = useMemo(() => toMap(stores), [stores]);
  const counts = useMemo(() => {
    const lines = orders.flatMap((o) => o.items);
    return FLOW.map((s) => [s, lines.filter((l) => l.status === s).length]);
  }, [orders]);
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
      {isLoading || productsLoading ? (
        <p className="text-mute py-10 text-center">불러오는 중…</p>
      ) : (
        <div className="space-y-5">
          {orders.map((o) => (
            <div key={o.id} className="border border-line">
              <div className="flex items-center justify-between px-4 h-11 bg-cream border-b border-line text-[13px]">
                <span><b>{ymd(o.date)}</b> <span className="text-mute num ml-2">주문번호 {o.id}</span></span>
                <Link to={`/mypage/orders/${o.id}`} className="flex items-center text-ink-2 hover:text-ink">상세보기 <ChevronRight size={14} /></Link>
              </div>
              {o.items.map((l) => {
                const p = productById[l.productId];
                if (!p) return null;
                return (
                  <div key={l.lineId} className="flex flex-wrap sm:flex-nowrap gap-4 p-4 border-b border-line last:border-0">
                    <Link to={`/products/${p.id}`}><img src={p.images[0]} alt="" className="w-20 h-24 object-cover" /></Link>
                    <div className="flex-1 min-w-0 text-[13px]">
                      <StatusPill s={l.status} />
                      <div className="mt-1.5 text-mute">{storeById[p.storeId]?.name}</div>
                      <Link to={`/products/${p.id}`} className="font-medium text-[14px] hover:underline">{p.name}</Link>
                      <div className="text-mute mt-0.5">{l.option || '단일상품'} · {l.qty}개 · <b className="text-ink num">{won(l.unitPrice * l.qty)}</b></div>
                      {l.status === '배송완료' && <div className="text-[12px] text-moss mt-1">{ymd(new Date(l.date.getTime() + 9 * 864e5))} 자동 구매확정 예정</div>}
                    </div>
                    <div className="w-full sm:w-auto flex sm:flex-col gap-1.5 sm:items-stretch sm:min-w-[96px]"><LineActions l={{ ...l, orderId: o.id }} onReview={setReview} /></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <MyReviewModal line={review} onClose={() => setReview(null)} />
    </div>
  );
}
