// 정산 관리 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { PageHead, StatusPill, Modal, Kpi, Checkbox } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { toast } from '@/shared/stores/toastStore';
import { won, comma, ymd, pct, shortWon } from '@/shared/utils/format';

const NUM = { thClass: 'text-right', tdClass: 'text-right num', search: false };
const fmt = ({ getValue }) => comma(getValue());

// 선택 체크박스 · 보류 사유 버튼은 컴포넌트 상태를 쓰므로 열 정의를 useMemo 로 (컨벤션 4-7)
function buildColumns({ sel, toggle, setHold }) {
  return [
    {
      id: 'select', header: '', enableSorting: false, meta: { thClass: 'w-10', search: false },
      cell: ({ row }) => row.original.status === '지급예정' && <Checkbox checked={sel.has(row.original.id)} onChange={() => toggle(row.original.id)} />,
    },
    {
      accessorKey: 'storeName', header: '스토어',
      cell: ({ row }) => <><Link to={`/admin/stores/${row.original.storeId}`} className="font-semibold hover:underline">{row.original.storeName}</Link><div className="text-[11px] text-mute num">{row.original.id}</div></>,
    },
    { accessorKey: 'orders', header: '건수', meta: NUM },
    { accessorKey: 'gross', header: '구매확정 매출', meta: NUM, cell: fmt },
    { accessorKey: 'refund', header: '환불', meta: { ...NUM, tdClass: 'text-right num text-rust' }, cell: ({ getValue }) => `−${comma(getValue())}` },
    { accessorKey: 'rate', header: '수수료율', meta: NUM, cell: ({ getValue }) => pct(getValue()) },
    { accessorKey: 'commission', header: '판매수수료', meta: NUM, cell: fmt },
    { accessorKey: 'pgFee', header: '결제수수료', meta: NUM, cell: fmt },
    { accessorKey: 'payout', header: '지급액', meta: { ...NUM, tdClass: 'text-right num font-bold' }, cell: fmt },
    { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    {
      id: 'hold', header: '', enableSorting: false, meta: { search: false },
      cell: ({ row }) => row.original.status === '지급보류' && <button onClick={() => setHold(row.original)} className="btn btn-line btn-xs">사유</button>,
    },
  ];
}

export default function SettlementList() {
  const { data: settlements = [], isLoading, isError } = useAdminSettlementsQuery();
  const { data: stores = [] } = useAdminStoresQuery();
  const weeks = useMemo(() => [...new Set(settlements.map((s) => s.start.getTime()))], [settlements]);
  const [weekSel, setWeekSel] = useState(null);
  const week = weekSel ?? weeks[0];
  const [paid, setPaid] = useState(() => new Set()); // 지급 실행한 정산 ID (목업처럼 로컬 상태로만 반영)
  const [sel, setSel] = useState(() => new Set());
  const [hold, setHold] = useState(null);

  const list = useMemo(() => {
    const storeName = Object.fromEntries(stores.map((s) => [s.id, s.name]));
    return settlements
      .filter((s) => s.start.getTime() === week)
      .map((s) => ({ ...s, storeName: storeName[s.storeId] ?? s.storeId, status: paid.has(s.id) ? '지급완료' : s.status }));
  }, [settlements, stores, week, paid]);
  const payable = useMemo(() => list.filter((s) => s.status === '지급예정'), [list]);
  const tot = (k) => list.reduce((a, s) => a + s[k], 0);

  const columns = useMemo(() => {
    const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    return buildColumns({ sel, toggle, setHold });
  }, [sel]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: list, columns });

  const handlePay = () => {
    // TODO(구지훈): usePaySettlementsMutation
    const ids = [...sel].filter((id) => payable.find((p) => p.id === id));
    setPaid((prev) => new Set([...prev, ...ids]));
    toast(`${ids.length}건 지급 실행 (펌뱅킹 이체 요청)`);
    setSel(new Set());
  };
  const handleHoldSelected = () => {
    // TODO(구지훈): useHoldSettlementsMutation
    toast('선택 건 지급보류 처리');
  };
  const handleReleaseHold = () => {
    // TODO(구지훈): useReleaseSettlementHoldMutation
    setHold(null);
    toast('보류 해제 → 지급예정으로 변경');
  };

  return (
    <div>
      <PageHead title="정산 관리" desc="구매확정일 기준 주간 정산 · 지급액 = 구매확정 매출 − 환불 − 판매수수료(카테고리별) − 결제수수료(2.2%)"
        right={<button className="btn btn-line btn-sm"><Download size={14} /> 정산 명세 엑셀</button>} />
      <div className="panel p-4 flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold">정산 주차</span>
        <select value={week ?? ''} onChange={(e) => { setWeekSel(Number(e.target.value)); setSel(new Set()); }} className="field field-sm h-9 w-auto">
          {weeks.map((w) => <option key={w} value={w}>{ymd(new Date(w))} ~ {ymd(new Date(w + 6 * 864e5)).slice(5)} (지급 {ymd(new Date(w + 10 * 864e5)).slice(5)})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mt-4">
        <Kpi label="구매확정 매출" value={shortWon(tot('gross'))} unit="원" />
        <Kpi label="환불 차감" value={comma(tot('refund') / 10000)} unit="만원" />
        <Kpi label="판매수수료 (플랫폼 수익)" value={comma(tot('commission') / 10000)} unit="만원" />
        <Kpi label="결제수수료 (PG)" value={comma(tot('pgFee') / 10000)} unit="만원" />
        <Kpi label="판매자 지급 총액" value={shortWon(tot('payout'))} unit="원" sub={`${list.length}개 스토어`} />
      </div>
      <div className="panel mt-4">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
          <Checkbox checked={payable.length > 0 && payable.every((s) => sel.has(s.id))} onChange={(on) => setSel(on ? new Set(payable.map((s) => s.id)) : new Set())} label="지급 대기 전체" className="mr-2" />
          <span className="text-ink-2 mr-2">선택 <b className="num text-ink">{sel.size}</b>건</span>
          <button disabled={!sel.size} onClick={handlePay} className="btn btn-ink btn-xs">지급 실행</button>
          <button disabled={!sel.size} onClick={handleHoldSelected} className="btn btn-line btn-xs">지급 보류</button>
          <span className="text-mute">지급 대기 {payable.length}건 · {won(payable.reduce((a, s) => a + s.payout, 0))}</span>
          <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="스토어 · 상태" className="ml-auto" />
        </div>
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} />
      </div>
      <Modal open={!!hold} onClose={() => setHold(null)} title="지급 보류 사유" width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setHold(null)}>닫기</button><button className="btn btn-ink btn-sm" onClick={handleReleaseHold}>보류 해제</button></>}>
        <p className="text-[14px]">{hold?.holdReason}</p>
      </Modal>
    </div>
  );
}
