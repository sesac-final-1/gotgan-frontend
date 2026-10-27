// 판매자 주문 관리 — 담당 이경석 (GET /api/seller/order-items — 서버 페이징 · 탭 · 검색, 컨벤션 4-7)
// 발주확인 · 송장 등록 · 배송완료는 일괄 PATCH — 일부만 실패하면 그 행에 사유를 보여 준다
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Download, Printer } from 'lucide-react';
import { PageHead, Segments, StatusPill, Checkbox, Modal } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useConfirmOrderItemsMutation, useDeliverOrderItemsMutation, useShipOrderItemsMutation } from '@/features/order/hooks/useSellerDeliveryMutations';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { FLOW, ITEM_STATUS_LABEL } from '@/features/order/constants';
import { bulkSummary, failureMap, statusOfTab, tabCounts, toShipItems } from '@/features/order/utils/sellerBulk';
import { toDate } from '@/features/order/utils/orderView';
import { toast } from '@/shared/stores/toastStore';
import { won, ymdhm, cx } from '@/shared/utils/format';

const COURIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'];
const TABS = ['전체', ...FLOW];
const PAGE_SIZE = 20;

// 열 정의는 선택 상태 · 실패 사유가 바뀔 때만 새로 만든다 (컨벤션 4-7). 정렬은 서버 고정(최신 주문 먼저)
function buildColumns({ sel, toggle, failures }) {
  return [
    {
      id: 'select', header: '', meta: { thClass: 'w-10' },
      cell: ({ row }) => <Checkbox checked={sel.has(row.original.orderItemId)} onChange={() => toggle(row.original.orderItemId)} />,
    },
    {
      accessorKey: 'itemNo', header: '상품주문번호',
      cell: ({ row: { original: o } }) => <Link to={`/seller/orders/${o.orderItemId}`} className="num text-sky hover:underline whitespace-nowrap">{o.itemNo}</Link>,
    },
    { accessorKey: 'orderedAt', header: '주문일시', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' }, cell: ({ getValue }) => ymdhm(toDate(getValue())) },
    { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={ITEM_STATUS_LABEL[getValue()] ?? getValue()} /> },
    {
      id: 'product', header: '상품 / 옵션',
      cell: ({ row: { original: o } }) => (
        <div className="flex items-center gap-2.5 min-w-[240px]">
          <img src={o.thumbnailUrl} alt="" className="w-9 h-9 object-cover bg-cream" />
          <div>
            <div className="truncate max-w-[240px]">{o.productName}</div>
            <div className="text-[11.5px] text-mute">{o.optionName || '단일상품'}</div>
            {failures[o.orderItemId] && <div className="text-[11.5px] text-rust">처리 실패: {failures[o.orderItemId]}</div>}
          </div>
        </div>
      ),
    },
    { accessorKey: 'quantity', header: '수량', meta: { thClass: 'text-right', tdClass: 'text-right num' } },
    { accessorKey: 'itemAmt', header: '결제금액', meta: { thClass: 'text-right', tdClass: 'text-right num whitespace-nowrap' }, cell: ({ getValue }) => won(getValue()) },
    { accessorKey: 'buyerName', header: '구매자', meta: { tdClass: 'whitespace-nowrap' } },
    {
      id: 'invoice', header: '택배사 / 송장', meta: { tdClass: 'whitespace-nowrap text-[12px]' },
      cell: ({ row: { original: o } }) => (o.trackingNo ? <><div>{o.courier}</div><div className="num text-mute">{o.trackingNo}</div></> : <span className="text-mute">-</span>),
    },
  ].map((c) => ({ ...c, enableSorting: false }));
}

export default function SellerOrderList() {
  const [sp] = useSearchParams();
  const [tab, setTab] = useState(TABS.includes(sp.get('s')) ? sp.get('s') : '전체');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [sel, setSel] = useState(() => new Set());
  const [failures, setFailures] = useState({}); // 직전 처리에서 실패한 행 → 사유
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [inputs, setInputs] = useState({}); // 송장 모달: orderItemId → { courier, trackingNo }
  const [range, setRange] = useState('1개월');
  const { data: store } = useMyStoreQuery();
  const defaultCourier = store?.courier || COURIERS[0];

  // 검색어는 입력이 멈추고 0.3초 뒤에 서버로 — 탭 · 검색이 바뀌면 1페이지로
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPageIndex(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading, isError } = useSellerOrderItemsQuery({ status: statusOfTab(tab) ?? undefined, q: q || undefined, page: pageIndex, size: PAGE_SIZE });
  const rows = useMemo(() => data?.items.content ?? [], [data]);

  const toggle = useCallback((id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const columns = useMemo(() => buildColumns({ sel, toggle, failures }), [sel, toggle, failures]);
  const table = useReactTable({
    data: rows, columns, getCoreRowModel: getCoreRowModel(),
    manualPagination: true, pageCount: data?.items.totalPages ?? 0,
    state: { pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (u) => { setPageIndex((typeof u === 'function' ? u({ pageIndex, pageSize: PAGE_SIZE }) : u).pageIndex); setSel(new Set()); },
  });

  const counts = tabCounts(data?.statusCounts);
  const selRows = rows.filter((r) => sel.has(r.orderItemId));
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.orderItemId));

  const confirmMutation = useConfirmOrderItemsMutation();
  const shipMutation = useShipOrderItemsMutation();
  const deliverMutation = useDeliverOrderItemsMutation();
  const busy = confirmMutation.isPending || shipMutation.isPending || deliverMutation.isPending;

  // 처리 결과 — 실패 행은 사유 표시 · 선택 유지, 성공 행은 선택 해제
  const run = async (mutation, payload, action) => {
    try {
      const r = await mutation.mutateAsync(payload);
      setFailures(failureMap(r));
      setSel(new Set(r.failed.map((f) => f.orderItemId)));
      toast(bulkSummary(action, r));
      return r;
    } catch (err) {
      toast(err.response?.data?.message ?? `${action}하지 못했어요. 잠시 후 다시 시도해 주세요.`);
      return null;
    }
  };
  const idsOf = (status) => selRows.filter((r) => r.status === status).map((r) => r.orderItemId);
  const confirm = () => {
    const ids = idsOf('PAYMENT_DONE');
    if (!ids.length) return toast('결제완료 상태의 주문만 발주확인할 수 있어요');
    void run(confirmMutation, ids, '발주확인');
  };
  const openInvoice = () => { setInputs({}); setInvoiceModal(true); };
  const ship = async () => {
    const ready = selRows.filter((r) => r.status === 'PREPARING');
    if (!ready.length) return toast('배송준비 상태의 주문만 발송처리할 수 있어요');
    if (await run(shipMutation, toShipItems(ready, inputs, defaultCourier), '발송처리')) setInvoiceModal(false);
  };
  const deliver = () => {
    const ids = idsOf('SHIPPING');
    if (!ids.length) return toast('배송중 상태의 주문만 배송완료 처리할 수 있어요');
    void run(deliverMutation, ids, '배송완료 처리');
  };
  const setInput = (id, field, value) => setInputs((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  // TODO(이경석): useCancelOrderItemsMutation (판매자 취소 — 서버 API 없음)
  const cancel = () => toast('주문 취소 처리 (구매자 환불)');
  // TODO(이경석): useNotifyShippingDelayMutation (서버 API 없음)
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
          <SearchInput value={search} onChange={setSearch} placeholder="상품주문번호 · 구매자 · 수령인 · 상품명 · 송장번호" className="sm:w-96" />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto"><Segments items={TABS} value={tab} onChange={(t) => { setTab(t); setPageIndex(0); setSel(new Set()); }} counts={counts} /></div>

      <div className="panel mt-3 border-b-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
          <Checkbox checked={allOn} onChange={(on) => setSel(on ? new Set(rows.map((r) => r.orderItemId)) : new Set())} />
          <span className="text-ink-2 mr-2">선택 <b className="num text-ink">{sel.size}</b>건</span>
          <button disabled={!sel.size || busy} onClick={confirm} className="btn btn-ink btn-xs">발주확인</button>
          <button disabled={!sel.size || busy} onClick={openInvoice} className="btn btn-line btn-xs">송장 입력 · 발송처리</button>
          <button disabled={!sel.size || busy} onClick={deliver} className="btn btn-line btn-xs">배송완료 처리</button>
          <button disabled={!sel.size} onClick={cancel} className="btn btn-line btn-xs">판매취소</button>
          <button disabled={!sel.size} onClick={notifyDelay} className="btn btn-line btn-xs">발송지연 안내</button>
          <button disabled={!sel.size} className="btn btn-ghost btn-xs ml-auto"><Printer size={13} /> 송장 출력</button>
        </div>
      </div>
      <DataTable table={table} loading={isLoading} error={isError} />

      {/* 송장 입력 표 — 선택한 주문의 입력 폼이라 DataTable 대신 목업 <table> 그대로 */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title={`송장 입력 · 발송처리 (${selRows.length}건)`} width={680}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setInvoiceModal(false)}>취소</button><button disabled={busy} className="btn btn-ink btn-sm" onClick={() => void ship()}>{shipMutation.isPending ? '처리 중…' : '발송처리'}</button></>}>
        <p className="text-[12.5px] text-mute mb-3">배송준비 상태 주문만 발송처리됩니다. 송장번호를 비우면 데모용 송장번호가 자동으로 붙어요.</p>
        <table className="tbl">
          <thead><tr><th>상품주문번호</th><th>수령인</th><th>택배사</th><th>송장번호</th></tr></thead>
          <tbody>
            {selRows.map((r) => {
              const off = r.status !== 'PREPARING';
              return (
                <tr key={r.orderItemId} className={cx(off && 'opacity-40')}>
                  <td className="num text-[12px]">{r.itemNo}{failures[r.orderItemId] && <div className="text-rust text-[11px]">{failures[r.orderItemId]}</div>}</td><td>{r.receiverName}</td>
                  <td><select value={inputs[r.orderItemId]?.courier ?? defaultCourier} onChange={(e) => setInput(r.orderItemId, 'courier', e.target.value)} disabled={off} className="field field-sm w-32">{COURIERS.map((c) => <option key={c}>{c}</option>)}</select></td>
                  <td><input value={inputs[r.orderItemId]?.trackingNo ?? ''} onChange={(e) => setInput(r.orderItemId, 'trackingNo', e.target.value)} className="field field-sm num w-40" placeholder="숫자만 입력 (비우면 자동)" disabled={off} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Modal>
    </div>
  );
}
