// 운영 대시보드 — 담당 구지훈
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { PageHead, Kpi, BarChart, HBars } from '@/shared/components/ui';
import { useAdminDashboardQuery } from '@/features/admin/hooks/useAdminDashboardQuery';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminReportsQuery } from '@/features/admin/hooks/useAdminReportsQuery';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { won, comma, pct, shortWon, ymd, cx } from '@/shared/utils/format';

// 일별 거래액 = order 결제일별 통계 최근 30일 (backend #107 · #112), 상품 현황 = product 통계 (#110).
// 카테고리별 거래액 · 스토어 순위 = 정산 통계의 최근 8주 구매확정분 (backend #103). 순위는 요약 표라 목업 <table> 그대로 (검색 · 정렬 없음)
export default function AdminDashboard() {
  const { data: dash, isLoading } = useAdminDashboardQuery();
  const { data: apps = [] } = useApplicationsQuery();
  const { data: stores = [] } = useAdminStoresQuery();
  const { data: reports = [] } = useAdminReportsQuery();
  const { data: users = [] } = useAdminUsersQuery();
  const { data: categories = [] } = useAdminCategoriesQuery();

  // 매출이 있는 카테고리만 온다 — 이름 · 수수료율은 카테고리 목록에서 (사용 중지 등으로 못 찾으면 번호)
  const catRows = useMemo(() => {
    const byId = Object.fromEntries(categories.map((c) => [c.categoryId, c]));
    return (dash?.settlement?.categorySales ?? []).map((r) => ({
      label: byId[r.categoryId]?.name ?? `카테고리 ${r.categoryId}`,
      value: r.salesAmt,
      note: byId[r.categoryId]?.commission == null ? '' : pct(byId[r.categoryId].commission),
    }));
  }, [categories, dash]);
  const storeRank = dash?.settlement?.topStores ?? [];

  if (isLoading || !dash) return <p className="text-mute py-10 text-center">불러오는 중…</p>;

  const { settlement, order, product, platformDaily } = dash; // 영역이 실패하면 null — 숫자 대신 '–'
  const hasDaily = platformDaily?.some((d) => d.amount > 0); // 모두 0 이면 차트 대신 안내 (막대 높이 기준이 없음)
  const count = (v) => v ?? '–';
  const todo = [
    ['입점 심사 대기', apps.filter((a) => a.status === '심사대기').length, '/admin/applications'],
    ['보완 요청 중', apps.filter((a) => a.status === '보완요청').length, '/admin/applications'],
    ['정산 지급 승인', count(settlement?.scheduledCount), '/admin/settlements'],
    ['지급 보류', count(settlement?.heldCount), '/admin/settlements'],
    ['신고 처리 대기', reports.reduce((a, t) => a + t.openCount, 0), '/admin/reports'],
    ['이용정지 회원', users.filter((u) => u.status === '이용정지').length, '/admin/users'],
  ];
  return (
    <div>
      <PageHead title="운영 대시보드" desc="거래액은 결제 기준, 수수료 수익 · 지급액은 정산서 기준" />
      <div className="panel grid grid-cols-3 md:grid-cols-6">
        {todo.map(([k, n, to], i) => (
          <Link key={k} to={to} className={cx('px-4 py-4 hover:bg-cream border-line', i % 3 && 'border-l', i >= 3 && 'border-t md:border-t-0', i % 6 && 'md:border-l')}>
            <div className="text-[12.5px] text-ink-2">{k}</div>
            <div className={cx('mt-1 text-[24px] font-bold num', n && n !== '–' ? 'text-point' : 'text-line-2')}>{n}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <Kpi label="누적 거래액 (GMV)" value={order ? shortWon(order.totalTradeAmt) : '–'} unit="원" sub={order ? `결제 완료 주문 ${comma(order.orderCount)}건` : '주문 통계를 불러오지 못했어요'} />
        <Kpi label="이번 달 수수료 수익" value={settlement ? comma(settlement.commissionRevenueThisMonth / 10000) : '–'} unit="만원" sub="판매수수료 (결제수수료 제외)" />
        <Kpi label="지급 예정 · 보류" value={settlement ? shortWon(settlement.scheduledAmt) : '–'} unit="원" sub={settlement ? `보류 ${won(settlement.heldAmt)} · 이번 달 지급 ${shortWon(settlement.paidThisMonthAmt)}원` : '정산 통계를 불러오지 못했어요'} />
        <Kpi label="운영 스토어 / 회원" value={`${stores.filter((s) => s.status === '운영중').length}`} unit={`곳 · ${comma(users.length)}명`}
          sub={product ? `판매중 상품 ${comma(product.onSaleCount)} · 품절 ${comma(product.soldOutCount)} · 강제중지 ${comma(product.blockedCount)}` : '상품 통계를 불러오지 못했어요'} />
      </div>
      <div className="grid xl:grid-cols-[1fr_360px] gap-4 mt-4">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">일별 거래액 · 최근 30일</span></div>
          <div className="p-5">{hasDaily ? <BarChart data={platformDaily} /> : <p className="text-mute text-[13px] text-center py-6">{platformDaily ? '최근 30일 결제가 없어요' : '주문 통계를 불러오지 못했어요'}</p>}</div>
        </div>
        <div className="panel">
          <div className="panel-head"><span className="panel-title">카테고리별 거래액 (8주 · 구매확정)</span><span className="text-[11.5px] text-mute">수수료율</span></div>
          <div className="p-5">{catRows.length ? <HBars rows={catRows} format={(v) => `${shortWon(v)}원`} /> : <p className="text-mute text-[13px] text-center py-6">{settlement ? '최근 8주 구매확정이 없어요' : '정산 통계를 불러오지 못했어요'}</p>}</div>
        </div>
      </div>
      <div className="panel mt-4 overflow-x-auto">
        <div className="panel-head"><span className="panel-title">스토어 거래액 순위 (최근 8주 · 구매확정 · 상위 10)</span><Link to="/admin/stores" className="text-[12px] text-mute flex items-center gap-1">스토어 관리 <ArrowRight size={12} /></Link></div>
        <table className="tbl">
          <thead><tr><th className="w-12">순위</th><th>스토어</th><th className="text-right">구매확정</th><th className="text-right">거래액</th><th className="text-right">수수료 수익</th></tr></thead>
          <tbody>
            {storeRank.map((r, i) => (
              <tr key={r.storeId}>
                <td className="num font-bold">{i + 1}</td>
                <td className="font-semibold">{r.storeName ?? `스토어 ${r.storeId}`}</td>
                <td className="text-right num">{comma(r.itemCount)}건</td>
                <td className="text-right num">{won(r.salesAmt)}</td>
                <td className="text-right num">{won(r.commissionAmt)}</td>
              </tr>
            ))}
            {!storeRank.length && <tr><td colSpan={5} className="text-mute text-center py-6">{settlement ? '최근 8주 구매확정이 없어요' : '정산 통계를 불러오지 못했어요'}</td></tr>}
          </tbody>
        </table>
        {settlement?.salesFrom && <p className="px-4 py-2 text-[11.5px] text-mute">{ymd(new Date(`${settlement.salesFrom}T00:00:00+09:00`))}부터 · 정산 데이터 기준 (거래액은 포인트 차감 전 상품주문 금액)</p>}
      </div>
    </div>
  );
}
