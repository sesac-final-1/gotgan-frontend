// 판매자 대시보드 — 담당 박지연. 통계는 GET /api/seller/dashboard(store.md 15절), 그 밖은 각 담당 API(15절 "넣지 않은 것")
import { Link } from 'react-router';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { Kpi, BarChart, PageHead, Stars, StatusPill } from '@/shared/components/ui';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useSellerDashboardQuery } from '@/features/store/hooks/useSellerDashboardQuery';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { ITEM_STATUS_LABEL } from '@/features/order/constants';
import { useSellerReviewsQuery, useSellerReviewSummaryQuery } from '@/features/review/hooks/useSellerReviews';
import { useSellerInquirySummaryQuery } from '@/features/review/hooks/useInquiries';
import { won, comma, ymd, cx } from '@/shared/utils/format';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const RECENT_ORDERS = { page: 0, size: 6 };
const RECENT_REVIEWS = { tab: 'ALL', page: 0, size: 3 };

// 통계 영역을 못 받으면(unavailable) 그 카드만 안내 — 나머지는 정상 표시(15절)
const Unavailable = () => <p className="text-mute text-[13px] text-center py-6">일시적으로 불러올 수 없어요</p>;

export default function SellerDashboard() {
  const { data: store, isError: storeError, refetch: refetchStore } = useMyStoreQuery();
  const { data: dash, isError: dashError, refetch: refetchDash } = useSellerDashboardQuery();
  // 할 일 숫자 · 최근 주문은 판매자 주문 API 하나로 — 주문 관리 화면 탭 숫자와 같은 출처
  const { data: orders } = useSellerOrderItemsQuery(RECENT_ORDERS);
  const { data: reviewSummary } = useSellerReviewSummaryQuery();
  const { data: reviews } = useSellerReviewsQuery(RECENT_REVIEWS);
  const { data: inquiry } = useSellerInquirySummaryQuery();

  // 스토어 · 통계 없이는 화면을 못 그림 — 받은 값이 없는데 실패했으면 '불러오는 중' 대신 다시 시도 안내
  if ((!store && storeError) || (!dash && dashError)) {
    const retry = () => { if (!store) refetchStore(); if (!dash) refetchDash(); };
    return (
      <div role="alert" className="py-10 text-center">
        <p className="text-mute">대시보드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        <button type="button" onClick={retry} className="btn btn-line btn-sm mt-3">다시 시도</button>
      </div>
    );
  }
  if (!store || !dash) return <p className="text-mute py-10 text-center">불러오는 중…</p>;

  const counts = orders?.statusCounts ?? {};
  const n = (status) => (orders ? counts[status] ?? 0 : '-');
  const todo = [
    ['신규주문', n('PAYMENT_DONE'), '/seller/orders?s=결제완료', true],
    ['배송준비', n('PREPARING'), '/seller/orders?s=배송준비'],
    ['배송중', n('SHIPPING'), '/seller/orders?s=배송중'],
    ['취소요청', n('CANCEL_REQUESTED'), '/seller/claims', true],
    ['반품요청', n('RETURN_REQUESTED'), '/seller/claims', true],
    ['교환요청', n('EXCHANGE_REQUESTED'), '/seller/claims', true],
    ['미답변 문의', inquiry ? inquiry.unanswered : '-', '/seller/qna', true],
  ];
  const { daily, product, settlement } = dash;
  const yday = daily?.at(-2)?.amount;
  const month = daily?.reduce((a, d) => a + d.amount, 0);
  const now = new Date();

  return (
    <div>
      <PageHead title={`${store.owner} 대표님, 좋은 하루예요`} desc={`${ymd(now)} (${WEEKDAY[now.getDay()]}) · ${store.name} 스토어 현황`}
        right={<Link to="/seller/products/new" className="btn btn-ink btn-sm">+ 상품 등록</Link>} />
      {store.status === '정지' && <div className="panel p-4 mb-4 text-[13px] text-rust">스토어가 정지 중이에요 — 상품이 쇼핑몰에 노출되지 않습니다{store.statusReason && ` (사유: ${store.statusReason})`}</div>}
      {store.status === '폐점' && <div className="panel p-4 mb-4 text-[13px] text-mute">폐점한 스토어입니다</div>}

      {/* 할 일 */}
      <div className="panel grid grid-cols-4 md:grid-cols-7">
        {todo.map(([k, v, to, urgent], i) => (
          <Link key={k} to={to} className={cx('px-4 py-4 hover:bg-cream border-line', i % 4 && 'border-l', i >= 4 && 'border-t md:border-t-0', i % 7 && 'md:border-l')}>
            <div className="text-[12.5px] text-ink-2">{k}</div>
            <div className={cx('mt-1 text-[24px] font-bold num', v && v !== '-' && urgent ? 'text-point' : v && v !== '-' ? 'text-ink' : 'text-line-2')}>{v}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <Kpi label="오늘 결제금액" value={dash.todaySales == null ? '-' : comma(dash.todaySales)} unit="원"
          delta={dash.todaySales != null && yday ? ((dash.todaySales - yday) / yday) * 100 : undefined} sub={yday ? '전일 대비' : '어제 결제 없음'} />
        <Kpi label="최근 30일 결제금액" value={month == null ? '-' : comma(month)} unit="원" sub="오늘 포함 30일" />
        <Kpi label="다음 지급 예정" value={settlement?.nextPayout ? comma(settlement.nextPayout.payout) : '-'} unit="원"
          sub={settlement ? (settlement.nextPayout ? `${ymd(settlement.nextPayout.pay)} 지급` : '지급 예정 없음') : '일시적으로 불러올 수 없어요'} />
        <Kpi label="스토어 평점" value={(reviewSummary?.averageRating ?? 0).toFixed(2)} unit="/ 5" sub={`리뷰 ${comma(reviewSummary?.ratedCount ?? 0)}개`} />
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-4 mt-4">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">일별 결제금액 · 최근 30일</span><span className="text-[12px] text-mute">막대에 마우스를 올리면 상세 금액</span></div>
          <div className="p-5">
            {!daily ? <Unavailable /> : daily.some((d) => d.amount > 0) ? <BarChart data={daily} /> : <p className="text-mute text-[13px] text-center py-6">최근 30일 결제가 없어요</p>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><span className="panel-title">상품 현황</span><Link to="/seller/products" className="text-[12px] text-mute">전체</Link></div>
          {!product ? <Unavailable /> : (
            <dl className="grid grid-cols-2">
              {[['판매중', product.onSale], ['재고 부족', product.lowStock], ['품절', product.soldOut], ['판매중지', product.stopped]].map(([k, v], i) => (
                <div key={k} className={cx('px-5 py-4 border-line', i % 2 && 'border-l', i >= 2 && 'border-t')}>
                  <dt className="text-[12.5px] text-ink-2">{k}</dt><dd className="mt-1 text-[22px] font-bold num">{comma(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mt-4">
        <div className="panel xl:col-span-2">
          <div className="panel-head"><span className="panel-title">최근 주문</span><Link to="/seller/orders" className="text-[12px] text-mute flex items-center gap-1">주문 관리 <ArrowRight size={12} /></Link></div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>상품주문번호</th><th>상품</th><th>구매자</th><th className="text-right">금액</th><th>상태</th></tr></thead>
              <tbody>
                {(orders?.items.content ?? []).map((o) => (
                  <tr key={o.orderItemId}>
                    <td><Link to={`/seller/orders/${o.orderItemId}`} className="num text-sky hover:underline">{o.itemNo}</Link></td>
                    <td className="max-w-[220px] truncate">{o.productName}</td>
                    <td>{o.buyerName}</td>
                    <td className="text-right num">{won(o.itemAmt)}</td>
                    <td><StatusPill s={ITEM_STATUS_LABEL[o.status] ?? o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders && orders.items.content.length === 0 && <p className="text-mute text-[13px] text-center py-6">아직 주문이 없어요</p>}
          </div>
        </div>
        <div className="space-y-4">
          {product?.lowStockProducts.length > 0 && (
            <div className="panel border-amber/40">
              <div className="panel-head"><span className="panel-title flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber" /> 재고 부족</span></div>
              {product.lowStockProducts.map((p) => (
                <Link key={p.id} to={`/seller/products/${p.id}/edit`} className="flex items-center justify-between px-5 py-2.5 border-b border-line last:border-0 text-[13px] hover:bg-cream">
                  <span className="truncate pr-3">{p.name}</span><span className="num font-bold text-amber">{p.stock}개</span>
                </Link>
              ))}
            </div>
          )}
          <div className="panel">
            <div className="panel-head"><span className="panel-title">새 리뷰</span><Link to="/seller/reviews" className="text-[12px] text-mute">답글 달기</Link></div>
            {(reviews?.content ?? []).map((r) => (
              <div key={r.id} className="px-5 py-3 border-b border-line last:border-0">
                <div className="flex items-center gap-2 text-[12px]"><Stars value={r.rating} size={11} /><span className="text-mute">{r.writer} · {r.productName}</span></div>
                <p className="text-[13px] mt-1 line-clamp-2 text-ink-2">{r.body}</p>
              </div>
            ))}
            {reviews && reviews.content.length === 0 && <p className="text-mute text-[13px] text-center py-6">아직 리뷰가 없어요</p>}
          </div>
        </div>
      </div>
      {settlement && <p className="text-[12px] text-mute mt-4">이번 주 구매확정분 정산 예정 {won(settlement.pendingPayout)}({comma(settlement.pendingCount)}건) · 다음 주 목요일 지급</p>}
    </div>
  );
}
