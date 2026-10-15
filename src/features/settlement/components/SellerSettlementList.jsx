// 판매자 정산 내역 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHead, StatusPill, Modal, Kpi, KV } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useSellerSettlementsQuery } from '@/features/settlement/hooks/useSellerSettlementsQuery';
import { useSellerPendingQuery } from '@/features/settlement/hooks/useSellerPendingQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { won, comma, ymd, pct } from '@/shared/utils/format';

const NUM = { thClass: 'text-right', tdClass: 'text-right num' };

// 열 정의 — 상세 버튼이 setDetail 을 써서 함수로 만들고 컴포넌트에서 useMemo (컨벤션 4-7)
function buildColumns(setDetail) {
  return [
    { accessorKey: 'id', header: '정산번호', meta: { tdClass: 'num text-[12px]' } },
    {
      accessorKey: 'start', header: '정산 대상기간 (구매확정)', sortingFn: 'datetime', meta: { tdClass: 'num whitespace-nowrap' },
      cell: ({ row: { original: s } }) => `${ymd(s.start)} ~ ${ymd(s.end).slice(5)}`,
    },
    { accessorKey: 'orders', header: '건수', meta: NUM },
    { accessorKey: 'gross', header: '구매확정 매출', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
    { accessorKey: 'refund', header: '환불', meta: { thClass: 'text-right', tdClass: 'text-right num text-rust' }, cell: ({ getValue }) => `−${comma(getValue())}` },
    { accessorKey: 'commission', header: '판매수수료', meta: NUM, cell: ({ getValue }) => `−${comma(getValue())}` },
    { accessorKey: 'pgFee', header: '결제수수료', meta: NUM, cell: ({ getValue }) => `−${comma(getValue())}` },
    { accessorKey: 'payout', header: '정산금액', meta: { thClass: 'text-right', tdClass: 'text-right num font-bold' }, cell: ({ getValue }) => comma(getValue()) },
    { accessorKey: 'pay', header: '지급일', sortingFn: 'datetime', meta: { tdClass: 'num' }, cell: ({ getValue }) => ymd(getValue()) },
    { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    {
      id: 'action', header: '', enableSorting: false, meta: { search: false },
      cell: ({ row }) => <button onClick={() => setDetail(row.original)} className="btn btn-line btn-xs">상세</button>,
    },
  ];
}

export default function SellerSettlementList() {
  const { data: mine = [], isLoading, isError } = useSellerSettlementsQuery();
  const { data: pending } = useSellerPendingQuery();
  const { data: store } = useMyStoreQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const [detail, setDetail] = useState(null);
  const columns = useMemo(() => buildColumns(setDetail), []);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: mine, columns, initialSorting: [{ id: 'start', desc: true }] });

  const c = categories.find((x) => x.id === store?.cat);
  const done = mine.filter((s) => s.status === '지급완료');
  const total = done.reduce((a, s) => a + s.payout, 0);
  return (
    <div>
      <PageHead title="정산 내역" desc="구매확정일 기준 주 1회 정산 · 월~일 확정분을 다음 주 목요일에 등록 계좌로 지급합니다."
        right={<button className="btn btn-line btn-sm"><Download size={14} /> 정산내역 엑셀</button>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="이번 주 집계중 (9/28~)" value={pending ? comma(pending.confirmed) : '-'} unit="원" sub="구매확정 누적 매출" />
        <Kpi label="다음 지급 예정" value={mine[0] ? comma(mine[0].payout) : '-'} unit="원" sub={mine[0] ? `${ymd(mine[0].pay)} (목)` : ''} />
        <Kpi label="최근 8주 지급 완료" value={comma(total / 10000)} unit="만원" sub={`${done.length}회`} />
        <Kpi label="적용 수수료율" value={c ? pct(c.commission + PAYMENT_FEE, 1) : '-'} sub={c ? `판매 ${pct(c.commission)} + 결제 2.2%` : ''} />
      </div>
      <div className="flex mt-4">
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="정산번호 · 상태" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} className="mt-3" />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`정산 상세 · ${detail?.id}`} width={520}>
        {detail && (
          <div className="text-[14px]">
            <div className="text-[13px] text-mute mb-3">대상기간 {ymd(detail.start)} ~ {ymd(detail.end)} · 지급일 {ymd(detail.pay)}</div>
            <div className="border-t border-ink num">
              {[['구매확정 매출', detail.gross], ['환불·취소', -detail.refund], [`판매수수료 (${pct(detail.rate)})`, -detail.commission], ['결제수수료 (2.2%)', -detail.pgFee]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 border-b border-line"><span className="font-sans text-ink-2">{k}</span><span>{v < 0 ? '−' : ''}{won(Math.abs(v))}</span></div>
              ))}
              <div className="flex justify-between py-3 text-[17px] font-bold"><span className="font-sans">정산금액</span><span>{won(detail.payout)}</span></div>
            </div>
            <KV rows={[['지급 계좌', detail.bank], ['세금계산서', '수수료 세금계산서 매월 10일 자동 발행']]} />
          </div>
        )}
      </Modal>
    </div>
  );
}
