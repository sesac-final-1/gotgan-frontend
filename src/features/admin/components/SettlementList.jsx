// 정산 관리 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { PageHead, StatusPill, Modal, Kpi, Checkbox } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminSettlementWeekQuery } from '@/features/admin/hooks/useAdminSettlementWeekQuery';
import { recentWeeks } from '@/features/admin/constants';
import { usePaySettlementsMutation, useHoldSettlementsMutation, useReleaseSettlementHoldMutation } from '@/features/admin/hooks/useSettlementMutations';
import { toast } from '@/shared/stores/toastStore';
import { won, comma, ymd, pct, shortWon } from '@/shared/utils/format';

const NUM = { thClass: 'text-right', tdClass: 'text-right num', search: false };
const fmt = ({ getValue }) => comma(getValue());
const errMsg = (err, fallback) => err.response?.data?.message ?? fallback;

const DAY = 864e5;

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
    {
      accessorKey: 'orders', header: '건수', meta: NUM,
      cell: ({ row }) => <>{row.original.orders}{row.original.carriedOver > 0 && <div className="text-[11px] text-mute">이월 {row.original.carriedOver}</div>}</>,
    },
    { accessorKey: 'gross', header: '구매확정 매출', meta: NUM, cell: fmt },
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
  const weeks = useMemo(() => recentWeeks(), []);
  const [week, setWeek] = useState(() => weeks[0].key);
  const { data: list = [], isLoading, isError } = useAdminSettlementWeekQuery(week);
  const pay = usePaySettlementsMutation();
  const holdMany = useHoldSettlementsMutation();
  const release = useReleaseSettlementHoldMutation();
  const [sel, setSel] = useState(() => new Set());
  const [hold, setHold] = useState(null);
  const [holdOpen, setHoldOpen] = useState(false); // 선택 건 보류 사유 입력
  const [holdReason, setHoldReason] = useState('');

  const payable = useMemo(() => list.filter((s) => s.status === '지급예정'), [list]);
  const tot = (k) => list.reduce((a, s) => a + s[k], 0);

  const columns = useMemo(() => {
    const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    return buildColumns({ sel, toggle, setHold });
  }, [sel]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: list, columns });

  const selectedIds = () => [...sel].filter((id) => payable.some((p) => p.id === id));
  const handlePay = () => {
    pay.mutate(selectedIds(), {
      onSuccess: ({ success, failed }) => {
        toast(failed.length ? `${success.length}건 지급 · ${failed.length}건 실패 — ${failed[0].message}` : `${success.length}건 지급 실행 (펌뱅킹 이체 요청)`);
        setSel(new Set());
      },
      onError: (err) => toast(errMsg(err, '지급을 실행하지 못했어요. 잠시 후 다시 시도해 주세요.')),
    });
  };
  const handleHoldSelected = () => {
    holdMany.mutate({ ids: selectedIds(), reason: holdReason.trim() }, {
      onSuccess: (results) => {
        const failed = results.filter((r) => r.status === 'rejected');
        toast(failed.length ? `${results.length - failed.length}건 보류 · ${failed.length}건 실패 — ${errMsg(failed[0].reason, '')}` : `${results.length}건 지급보류 처리`);
        setSel(new Set());
        setHoldOpen(false);
        setHoldReason('');
      },
    });
  };
  const handleReleaseHold = () => {
    release.mutate(hold.id, {
      onSuccess: () => { setHold(null); toast('보류 해제 → 지급예정으로 변경'); },
      onError: (err) => toast(errMsg(err, '보류를 해제하지 못했어요. 잠시 후 다시 시도해 주세요.')),
    });
  };

  return (
    <div>
      <PageHead title="정산 관리" desc="구매확정일 기준 주간 정산 · 지급액 = 구매확정 매출 − 판매수수료(카테고리별) − 결제수수료(2.2%) · 환불은 구매확정 전에 끝나 정산에 들어오지 않음"
        right={<button className="btn btn-line btn-sm"><Download size={14} /> 정산 명세 엑셀</button>} />
      <div className="panel p-4 flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold">정산 주차</span>
        <select value={week} onChange={(e) => { setWeek(e.target.value); setSel(new Set()); }} className="field field-sm h-9 w-auto">
          {weeks.map(({ key, start: w }) => <option key={key} value={key}>{ymd(w)} ~ {ymd(new Date(w.getTime() + 6 * DAY)).slice(5)} (지급 {ymd(new Date(w.getTime() + 10 * DAY)).slice(5)})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <Kpi label="구매확정 매출" value={shortWon(tot('gross'))} unit="원" />
        <Kpi label="판매수수료 (플랫폼 수익)" value={comma(tot('commission') / 10000)} unit="만원" />
        <Kpi label="결제수수료 (PG)" value={comma(tot('pgFee') / 10000)} unit="만원" />
        <Kpi label="판매자 지급 총액" value={shortWon(tot('payout'))} unit="원" sub={`${list.length}개 스토어`} />
      </div>
      <div className="panel mt-4">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
          <Checkbox checked={payable.length > 0 && payable.every((s) => sel.has(s.id))} onChange={(on) => setSel(on ? new Set(payable.map((s) => s.id)) : new Set())} label="지급 대기 전체" className="mr-2" />
          <span className="text-ink-2 mr-2">선택 <b className="num text-ink">{sel.size}</b>건</span>
          <button disabled={!sel.size || pay.isPending} onClick={handlePay} className="btn btn-ink btn-xs">지급 실행</button>
          <button disabled={!sel.size} onClick={() => setHoldOpen(true)} className="btn btn-line btn-xs">지급 보류</button>
          <span className="text-mute">지급 대기 {payable.length}건 · {won(payable.reduce((a, s) => a + s.payout, 0))}</span>
          <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="스토어 · 상태" className="ml-auto" />
        </div>
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} />
      </div>
      <Modal open={!!hold} onClose={() => setHold(null)} title="지급 보류 사유" width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setHold(null)}>닫기</button><button className="btn btn-ink btn-sm" disabled={release.isPending} onClick={handleReleaseHold}>보류 해제</button></>}>
        <p className="text-[14px]">{hold?.holdReason}</p>
      </Modal>
      <Modal open={holdOpen} onClose={() => setHoldOpen(false)} title={`선택 ${sel.size}건 지급 보류`} width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setHoldOpen(false)}>닫기</button><button className="btn btn-ink btn-sm" disabled={!holdReason.trim() || holdMany.isPending} onClick={handleHoldSelected}>보류</button></>}>
        <textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="보류 사유 (판매자 정산 화면에 표시)" rows={3} className="field w-full" />
      </Modal>
    </div>
  );
}
