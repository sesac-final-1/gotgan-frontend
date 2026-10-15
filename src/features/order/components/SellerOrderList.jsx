// 판매자 주문 관리 — 담당 이경석
// TODO(이경석): 서버 페이징 전환 — manualPagination · manualSorting, useSellerOrderItemsQuery(params)
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Download, Printer } from 'lucide-react';
import { PageHead, Segments, StatusPill, Checkbox, Modal } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { FLOW } from '@/features/order/constants';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { won, ymdhm, cx } from '@/shared/utils/format';

const COURIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'];
const TABS = ['전체', ...FLOW];

// 열 정의는 상품 Map · 선택 상태가 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ productById, sel, toggle }) {
  return [
    {
      id: 'select', header: '', enableSorting: false, meta: { thClass: 'w-10', search: false },
      cell: ({ row }) => <Checkbox checked={sel.has(row.original.lineId)} onChange={() => toggle(row.original.lineId)} />,
    },
    {
      accessorKey: 'lineId', header: '상품주문번호',
      cell: ({ getValue }) => <Link to={`/seller/orders/${getValue()}`} className="num text-sky hover:underline whitespace-nowrap">{getValue()}</Link>,
    },
    { accessorKey: 'date', header: '주문일시', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' }, cell: ({ getValue }) => ymdhm(getValue()) },
    { accessorKey: 'status', header: '상태', filterFn: 'equals', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    {
      id: 'product', accessorFn: (o) => `${productById[o.productId]?.name ?? ''} ${o.option}`, header: '상품 / 옵션',
      cell: ({ row: { original: o } }) => {
        const p = productById[o.productId];
        return <div className="flex items-center gap-2.5 min-w-[240px]"><img src={p?.images[0]} alt="" className="w-9 h-9 object-cover" /><div><div className="truncate max-w-[240px]">{p?.name}</div><div className="text-[11.5px] text-mute">{o.option}</div></div></div>;
      },
    },
    { accessorKey: 'qty', header: '수량', meta: { thClass: 'text-right', tdClass: 'text-right num' } },
    { id: 'amount', accessorFn: (o) => o.unitPrice * o.qty, header: '결제금액', meta: { thClass: 'text-right', tdClass: 'text-right num whitespace-nowrap' }, cell: ({ getValue }) => won(getValue()) },
    { accessorKey: 'receiver', header: '구매자', meta: { tdClass: 'whitespace-nowrap' } },
    {
      id: 'invoice', accessorFn: (o) => (o.invoice ? `${o.courier} ${o.invoice}` : ''), header: '택배사 / 송장', meta: { tdClass: 'whitespace-nowrap text-[12px]' },
      cell: ({ row: { original: o } }) => (o.invoice ? <><div>{o.courier}</div><div className="num text-mute">{o.invoice}</div></> : <span className="text-mute">-</span>),
    },
  ];
}

// 지금은 전체 1회 로드 + 화면에서 탭 · 검색 · 정렬 · 페이징. 처리 결과는 목업처럼 로컬 상태로만 반영
export default function SellerOrderList() {
  const [sp] = useSearchParams();
  const { data: orders = [], isLoading, isError } = useSellerOrderItemsQuery();
  const { data: products = [] } = useProductsQuery();
  const { data: store } = useMyStoreQuery();
  const [patch, setPatch] = useState({}); // 목업 흉내: lineId → 바뀐 필드(status · invoice)
  const [tab, setTab] = useState(sp.get('s') || '전체');
  const [sel, setSel] = useState(() => new Set());
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [range, setRange] = useState('1개월');

  const productById = useMemo(() => toMap(products), [products]);
  const rows = useMemo(() => orders.map((o) => (patch[o.lineId] ? { ...o, ...patch[o.lineId] } : o)), [orders, patch]);
  const toggle = useCallback((id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const columns = useMemo(() => buildColumns({ productById, sel, toggle }), [productById, sel, toggle]);
  const columnFilters = useMemo(() => (tab === '전체' ? [] : [{ id: 'status', value: tab }]), [tab]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: rows, columns, columnFilters, initialSorting: [{ id: 'date', desc: true }] });

  const counts = Object.fromEntries(TABS.map((t) => [t, t === '전체' ? rows.length : rows.filter((r) => r.status === t).length]));
  const list = table.getFilteredRowModel().rows.map((r) => r.original);
  const selRows = rows.filter((r) => sel.has(r.lineId));
  const allOn = list.length > 0 && list.every((r) => sel.has(r.lineId));

  // TODO(이경석): useConfirmOrderItemsMutation
  const confirm = () => {
    const ok = selRows.filter((r) => r.status === '결제완료');
    if (!ok.length) return toast('결제완료 상태의 주문만 발주확인할 수 있어요');
    setPatch((prev) => ({ ...prev, ...Object.fromEntries(ok.map((r) => [r.lineId, { ...prev[r.lineId], status: '배송준비' }])) }));
    toast(`${ok.length}건 발주확인 완료 → 배송준비`); setSel(new Set());
  };
  // TODO(이경석): useShipOrderItemsMutation
  const ship = () => {
    const ready = selRows.filter((r) => r.status === '배송준비');
    setPatch((prev) => ({ ...prev, ...Object.fromEntries(ready.map((r) => [r.lineId, { ...prev[r.lineId], status: '배송중', invoice: r.invoice || `6512${Math.floor(Math.random() * 1e8)}` }])) }));
    toast(`송장 등록 · 발송처리 완료 (구매자에게 알림톡 발송)`); setSel(new Set()); setInvoiceModal(false);
  };
  // TODO(이경석): useCancelOrderItemsMutation
  const cancel = () => toast('주문 취소 처리 (구매자 환불)');
  // TODO(이경석): useNotifyShippingDelayMutation
  const notifyDelay = () => toast('발송지연 안내가 구매자에게 발송되었어요');

  return (
    <div>
      <PageHead title="주문 관리" desc="결제완료 → 발주확인(배송준비) → 송장등록(배송중) → 배송완료 → 구매확정(자동 7일)"
        right={<button className="btn btn-line btn-sm"><Download size={14} /> 엑셀 다운로드</button>} />

      <div className="panel p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-[13px] font-semibold w-14">조회기간</span>
          <div className="flex">{['오늘', '1주일', '1개월', '3개월'].map((r, i) => <button key={r} onClick={() => setRange(r)} className={cx('h-9 px-3 text-[13px] border border-line-2', i && '-ml-px', range === r && 'bg-ink text-white border-ink relative')}>{r}</button>)}</div>
          <input type="date" defaultValue="2026-09-01" className="field field-sm w-36 h-9" /> ~ <input type="date" defaultValue="2026-10-01" className="field field-sm w-36 h-9" />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-[13px] font-semibold w-14">검색</span>
          <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="상품주문번호 · 구매자 · 상품명 · 송장번호" className="sm:w-96" />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto"><Segments items={TABS} value={tab} onChange={(t) => { setTab(t); setSel(new Set()); }} counts={counts} /></div>

      <div className="panel mt-3 border-b-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
          <Checkbox checked={allOn} onChange={(on) => setSel(on ? new Set(list.map((r) => r.lineId)) : new Set())} />
          <span className="text-ink-2 mr-2">선택 <b className="num text-ink">{sel.size}</b>건</span>
          <button disabled={!sel.size} onClick={confirm} className="btn btn-ink btn-xs">발주확인</button>
          <button disabled={!sel.size} onClick={() => setInvoiceModal(true)} className="btn btn-line btn-xs">송장 입력 · 발송처리</button>
          <button disabled={!sel.size} onClick={cancel} className="btn btn-line btn-xs">판매취소</button>
          <button disabled={!sel.size} onClick={notifyDelay} className="btn btn-line btn-xs">발송지연 안내</button>
          <button disabled={!sel.size} className="btn btn-ghost btn-xs ml-auto"><Printer size={13} /> 송장 출력</button>
        </div>
      </div>
      <DataTable table={table} loading={isLoading} error={isError} />

      {/* 송장 입력 표 — 선택한 주문의 입력 폼이라 DataTable 대신 목업 <table> 그대로 */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title={`송장 입력 · 발송처리 (${selRows.length}건)`} width={680}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setInvoiceModal(false)}>취소</button><button className="btn btn-ink btn-sm" onClick={ship}>발송처리</button></>}>
        <p className="text-[12.5px] text-mute mb-3">배송준비 상태 주문만 발송처리됩니다. 송장번호는 택배사 시스템으로 자동 검증됩니다.</p>
        <table className="tbl">
          <thead><tr><th>상품주문번호</th><th>수령인</th><th>택배사</th><th>송장번호</th></tr></thead>
          <tbody>
            {selRows.map((r) => (
              <tr key={r.lineId} className={cx(r.status !== '배송준비' && 'opacity-40')}>
                <td className="num text-[12px]">{r.lineId}</td><td>{r.receiver}</td>
                <td><select defaultValue={store?.courier} className="field field-sm w-32">{COURIERS.map((c) => <option key={c}>{c}</option>)}</select></td>
                <td><input className="field field-sm num w-40" defaultValue={r.invoice || ''} placeholder="숫자만 입력" disabled={r.status !== '배송준비'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    </div>
  );
}
