// 판매자 정산 내역 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHead, StatusPill, Modal, Kpi } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useSellerSettlementsQuery } from '@/features/settlement/hooks/useSellerSettlementsQuery';
import { useSellerSettlementQuery } from '@/features/settlement/hooks/useSellerSettlementQuery';
import { fetchSettlementReportUrl } from '@/features/settlement/api/settlementApi';
import SettlementDetailBody from '@/features/settlement/components/SettlementDetailBody';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { toast } from '@/shared/stores/toastStore';
import { comma, ymd, pct } from '@/shared/utils/format';

const NUM = { thClass: 'text-right', tdClass: 'text-right num' };

// 열 정의 — 상세 버튼이 setDetailId 를 써서 함수로 만들고 컴포넌트에서 useMemo (컨벤션 4-7)
function buildColumns(setDetailId) {
  return [
    { accessorKey: 'week', header: '정산 주차', meta: { tdClass: 'num text-[12px]' } },
    {
      accessorKey: 'start', header: '정산 대상기간 (구매확정)', sortingFn: 'datetime', meta: { tdClass: 'num whitespace-nowrap' },
      cell: ({ row: { original: s } }) => `${ymd(s.start)} ~ ${ymd(s.end).slice(5)}`,
    },
    {
      accessorKey: 'orders', header: '건수', meta: NUM,
      cell: ({ row: { original: s } }) => <>{s.orders}{s.carriedOver > 0 && <div className="text-[11px] text-mute">이월 {s.carriedOver}</div>}</>,
    },
    { accessorKey: 'gross', header: '구매확정 매출', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
    { accessorKey: 'commission', header: '판매수수료', meta: NUM, cell: ({ getValue }) => `−${comma(getValue())}` },
    { accessorKey: 'pgFee', header: '결제수수료', meta: NUM, cell: ({ getValue }) => `−${comma(getValue())}` },
    { accessorKey: 'payout', header: '정산금액', meta: { thClass: 'text-right', tdClass: 'text-right num font-bold' }, cell: ({ getValue }) => comma(getValue()) },
    { accessorKey: 'pay', header: '지급일', sortingFn: 'datetime', meta: { tdClass: 'num' }, cell: ({ getValue }) => ymd(getValue()) },
    { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    {
      id: 'action', header: '', enableSorting: false, meta: { search: false },
      cell: ({ row }) => <button onClick={() => setDetailId(row.original.id)} className="btn btn-line btn-xs">상세</button>,
    },
  ];
}

// 명세서는 지급 완료 건만 — 누를 때마다 10분짜리 링크를 받아 새 탭으로 (지급 전 · 생성 전이면 서버 메시지)
async function openReport(id) {
  try {
    window.open(await fetchSettlementReportUrl(id), '_blank', 'noopener');
  } catch (err) {
    toast(err.response?.data?.message ?? '명세서를 열지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

export default function SellerSettlementList() {
  const { data, isLoading, isError } = useSellerSettlementsQuery();
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const summary = data?.summary;
  const [detailId, setDetailId] = useState(null);
  const { data: detail } = useSellerSettlementQuery(detailId);
  const columns = useMemo(() => buildColumns(setDetailId), []);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: rows, columns, initialSorting: [{ id: 'start', desc: true }] });

  const next = summary?.nextPayout;
  const rates = summary?.rates ?? [];
  return (
    <div>
      <PageHead title="정산 내역" desc="구매확정일 기준 주 1회 정산 · 월~일 확정분을 다음 주 목요일에 등록 계좌로 지급합니다." />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="이번 주 정산 예정" value={summary ? comma(summary.pendingPayout) : '-'} unit="원" sub="이번 주 구매확정분 · 수수료 차감 후" />
        <Kpi label="다음 지급 예정" value={next ? comma(next.payout) : '-'} unit="원" sub={next ? `${ymd(next.pay)} (목)` : '지급 전 정산서 없음'} />
        <Kpi label="최근 8주 지급 완료" value={summary ? comma(summary.paidRecent8Weeks / 10000) : '-'} unit="만원" />
        <Kpi label="적용 수수료율" value={rates.length ? rates.map((r) => pct(r.rate + PAYMENT_FEE, 1)).join(' · ') : '-'}
          sub={rates.length ? rates.map((r) => `${r.name} ${pct(r.rate, 1)}`).join(' · ') + ' + 결제 2.2%' : '최근 구매확정 없음'} />
      </div>
      <div className="flex mt-4">
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="정산 주차 · 상태" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="아직 정산 내역이 없어요" className="mt-3" />
      <Modal open={detailId != null} onClose={() => setDetailId(null)} title={`정산 상세 · ${detail?.week ?? ''}`} width={600}
        footer={detail?.status === '지급완료' && <button className="btn btn-line btn-sm" onClick={() => void openReport(detail.id)}><Download size={14} /> 정산 명세서 (CSV)</button>}>
        {detail ? <SettlementDetailBody d={detail} /> : <p className="text-mute py-6 text-center">불러오는 중…</p>}
      </Modal>
    </div>
  );
}
