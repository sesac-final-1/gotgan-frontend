// 운영 대시보드 — 담당 구지훈
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { PageHead, Kpi, BarChart, HBars, StatusPill } from '@/shared/components/ui';
import { useAdminDashboardQuery } from '@/features/admin/hooks/useAdminDashboardQuery';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { toMap } from '@/shared/utils/collection';
import { won, comma, pct, shortWon, cx } from '@/shared/utils/format';

// 스토어 거래액 순위는 요약 표라 목업 <table> 그대로 (검색 · 정렬 없음)
export default function AdminDashboard() {
  const { data: dash, isLoading } = useAdminDashboardQuery();
  const { data: apps = [] } = useApplicationsQuery();
  const { data: stores = [] } = useAdminStoresQuery();
  const { data: settlements = [] } = useAdminSettlementsQuery();
  const { data: reviews = [] } = useAdminReviewsQuery();
  const { data: users = [] } = useAdminUsersQuery();
  const { data: categories = [] } = useAdminCategoriesQuery();
  const catById = useMemo(() => toMap(categories), [categories]);
  const platformDaily = useMemo(() => dash?.platformDaily ?? [], [dash]);

  const lastWeek = useMemo(
    () => (settlements.length ? settlements.filter((s) => s.start.getTime() === settlements[0].start.getTime()) : []),
    [settlements],
  );
  const catRows = useMemo(() => {
    const storeCat = Object.fromEntries(stores.map((s) => [s.id, s.cat]));
    return categories.map((c) => ({
      label: c.name,
      value: settlements.filter((s) => storeCat[s.storeId] === c.id).reduce((a, s) => a + s.gross, 0),
      note: pct(c.commission),
    })).sort((a, b) => b.value - a.value);
  }, [categories, settlements, stores]);
  const storeRank = useMemo(() => stores.map((s) => {
    const ss = settlements.filter((x) => x.storeId === s.id);
    return { s, gross: ss.reduce((a, x) => a + x.gross, 0), last: ss[0] };
  }).sort((a, b) => b.gross - a.gross), [stores, settlements]);

  if (isLoading || platformDaily.length < 2) return <p className="text-mute py-10 text-center">불러오는 중…</p>;

  const today = platformDaily.at(-1), yday = platformDaily.at(-2);
  const gmv = platformDaily.reduce((a, d) => a + d.amount, 0);
  const revenue = lastWeek.reduce((a, s) => a + s.commission, 0);
  const todo = [
    ['입점 심사 대기', apps.filter((a) => a.status === '심사대기').length, '/admin/applications'],
    ['보완 요청 중', apps.filter((a) => a.status === '보완요청').length, '/admin/applications'],
    ['정산 지급 승인', lastWeek.filter((s) => s.status === '지급예정').length, '/admin/settlements'],
    ['지급 보류', settlements.filter((s) => s.status === '지급보류').length, '/admin/settlements'],
    ['리뷰 검토', reviews.filter((r) => r.flag && !r.blinded).length, '/admin/reviews'],
    ['이용정지 회원', users.filter((u) => u.status === '이용정지').length, '/admin/users'],
  ];
  return (
    <div>
      <PageHead title="운영 대시보드" desc="2026.10.01 (목) 10:00 기준 · 거래액은 결제 기준, 수수료 수익은 구매확정 기준" />
      <div className="panel grid grid-cols-3 md:grid-cols-6">
        {todo.map(([k, n, to], i) => (
          <Link key={k} to={to} className={cx('px-4 py-4 hover:bg-cream border-line', i % 3 && 'border-l', i >= 3 && 'border-t md:border-t-0', i % 6 && 'md:border-l')}>
            <div className="text-[12.5px] text-ink-2">{k}</div>
            <div className={cx('mt-1 text-[24px] font-bold num', n ? 'text-point' : 'text-line-2')}>{n}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <Kpi label="오늘 거래액 (GMV)" value={shortWon(today.amount)} unit="원" delta={((today.amount - yday.amount) / yday.amount) * 100} sub="전일 대비" />
        <Kpi label="최근 30일 거래액" value={shortWon(gmv)} unit="원" delta={8.7} sub="직전 30일 대비" />
        <Kpi label="지난주 수수료 수익" value={comma(revenue / 10000)} unit="만원" sub="판매수수료 (결제수수료 제외)" />
        <Kpi label="운영 스토어 / 회원" value={`${stores.filter((s) => s.status === '운영중').length}`} unit={`곳 · ${comma(48210)}명`} sub="신규 회원 오늘 +128" />
      </div>
      <div className="grid xl:grid-cols-[1fr_360px] gap-4 mt-4">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">일별 거래액 · 최근 30일</span></div>
          <div className="p-5"><BarChart data={platformDaily} /></div>
        </div>
        <div className="panel">
          <div className="panel-head"><span className="panel-title">카테고리별 거래액 (8주)</span><span className="text-[11.5px] text-mute">수수료율</span></div>
          <div className="p-5"><HBars rows={catRows} format={(v) => `${shortWon(v)}원`} /></div>
        </div>
      </div>
      <div className="panel mt-4 overflow-x-auto">
        <div className="panel-head"><span className="panel-title">스토어 거래액 순위 (최근 8주)</span><Link to="/admin/stores" className="text-[12px] text-mute flex items-center gap-1">스토어 관리 <ArrowRight size={12} /></Link></div>
        <table className="tbl">
          <thead><tr><th className="w-12">순위</th><th>스토어</th><th>카테고리</th><th className="text-right">거래액</th><th className="text-right">수수료 수익</th><th>등급</th><th>상태</th></tr></thead>
          <tbody>
            {storeRank.map(({ s, gross }, i) => (
              <tr key={s.id}>
                <td className="num font-bold">{i + 1}</td>
                <td><Link to={`/admin/stores/${s.id}`} className="flex items-center gap-2 hover:underline"><span className="w-6 h-6 text-white text-[11px] font-bold flex items-center justify-center" style={{ background: s.color }}>{s.name[0]}</span>{s.name}</Link></td>
                <td className="text-ink-2">{catById[s.cat]?.name}</td>
                <td className="text-right num">{won(gross)}</td>
                <td className="text-right num">{won(gross * (catById[s.cat]?.commission ?? 0))}</td>
                <td>{s.grade}</td>
                <td><StatusPill s={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
