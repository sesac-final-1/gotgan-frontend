// 판매자 상품 조회/수정 — 담당 박지연
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Eye, Copy } from 'lucide-react';
import { PageHead, Segments, StatusPill, Checkbox, Modal } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { comma, ymd, salePrice, cx } from '@/shared/utils/format';

const STATUS_TABS = ['전체', '판매중', '품절', '판매중지'];

// 열 정의는 카테고리 Map · 선택 상태가 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ catById, sel, toggle }) {
  return [
    {
      id: 'select', header: '', enableSorting: false, meta: { thClass: 'w-10', search: false },
      cell: ({ row }) => <Checkbox checked={sel.has(row.original.id)} onChange={() => toggle(row.original.id)} />,
    },
    {
      accessorKey: 'name', header: '상품',
      cell: ({ row: { original: p } }) => (
        <div className="flex items-center gap-3 min-w-[260px]">
          <img src={p.images[0]} alt="" className="w-11 h-11 object-cover" />
          <div><Link to={`/seller/products/${p.id}/edit`} className="font-medium hover:underline">{p.name}</Link><div className="text-[11.5px] text-mute num">{p.id.toUpperCase()} · 옵션 {p.options.reduce((a, o) => a * o.values.length, 1)}개</div></div>
        </div>
      ),
    },
    { id: 'cat', accessorFn: (p) => `${catById[p.cat]?.name ?? p.cat} > ${p.sub}`, header: '카테고리', meta: { tdClass: 'text-ink-2 whitespace-nowrap' } },
    { accessorKey: 'price', header: '판매가', meta: { thClass: 'text-right', tdClass: 'text-right num' }, cell: ({ getValue }) => comma(getValue()) },
    {
      id: 'sale', accessorFn: (p) => (p.discount ? salePrice(p) : 0), header: '할인가', meta: { thClass: 'text-right', tdClass: 'text-right num' },
      cell: ({ row: { original: p } }) => (p.discount ? <><span className="text-point">{Math.round(p.discount * 100)}%</span> {comma(salePrice(p))}</> : '-'),
    },
    {
      accessorKey: 'stock', header: '재고', meta: { thClass: 'text-right', tdClass: 'text-right num' },
      cell: ({ getValue }) => <span className={cx(getValue() < 20 && 'text-rust font-bold')}>{comma(getValue())}</span>,
    },
    { accessorKey: 'status', header: '상태', filterFn: 'equals', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    { accessorKey: 'sold', header: '판매량', meta: { thClass: 'text-right', tdClass: 'text-right num' }, cell: ({ getValue }) => comma(getValue()) },
    {
      accessorKey: 'rating', header: '평점', meta: { tdClass: 'whitespace-nowrap' },
      cell: ({ row: { original: p } }) => <>★ {p.rating} <span className="text-mute num">({comma(p.reviews)})</span></>,
    },
    { accessorKey: 'created', header: '등록일', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2' }, cell: ({ getValue }) => ymd(getValue()) },
    {
      id: 'action', header: '관리', enableSorting: false, meta: { thClass: 'text-center', search: false },
      cell: ({ row: { original: p } }) => (
        <div className="flex gap-1 justify-center">
          <Link to={`/seller/products/${p.id}/edit`} className="btn btn-line btn-xs">수정</Link>
          <Link to={`/products/${p.id}`} className="btn btn-ghost btn-xs px-1.5" title="쇼핑몰에서 보기"><Eye size={14} /></Link>
          {/* TODO(박지연): useCopyProductMutation */}
          <button onClick={() => toast('상품을 복사했어요 (판매중지 상태로 생성)')} className="btn btn-ghost btn-xs px-1.5" title="복사"><Copy size={14} /></button>
        </div>
      ),
    },
  ];
}

// 판매자 상품은 데모 규모라 전체 1회 로드 후 화면에서 탭 · 검색 · 정렬 · 페이징 (컨벤션 4-7)
export default function SellerProductList() {
  const { data: products = [], isLoading, isError } = useProductsQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: store } = useMyStoreQuery();
  const [patch, setPatch] = useState({}); // 목업 흉내: 상품 id → 바뀐 상태
  const [removed, setRemoved] = useState({}); // 목업 흉내: 삭제한 상품 id
  const [status, setStatus] = useState('전체');
  const [sel, setSel] = useState(() => new Set());
  const [del, setDel] = useState(false);

  const catById = useMemo(() => toMap(categories), [categories]);
  const rows = useMemo(
    () => products.filter((p) => p.storeId === store?.id && !removed[p.id]).map((p) => (patch[p.id] ? { ...p, ...patch[p.id] } : p)),
    [products, store, patch, removed],
  );
  const toggle = useCallback((id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const columns = useMemo(() => buildColumns({ catById, sel, toggle }), [catById, sel, toggle]);
  const columnFilters = useMemo(() => (status === '전체' ? [] : [{ id: 'status', value: status }]), [status]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: rows, columns, columnFilters, initialSorting: [{ id: 'created', desc: true }] });

  const counts = { 전체: rows.length, 판매중: 0, 품절: 0, 판매중지: 0 };
  rows.forEach((r) => counts[r.status]++);
  const list = table.getFilteredRowModel().rows.map((r) => r.original);
  const allOn = list.length > 0 && list.every((r) => sel.has(r.id));
  // TODO(박지연): useUpdateProductStatusMutation
  const bulk = (st) => {
    setPatch((prev) => ({ ...prev, ...Object.fromEntries([...sel].map((id) => [id, { status: st }])) }));
    toast(`${sel.size}개 상품을 '${st}' 처리했어요`); setSel(new Set());
  };
  // TODO(박지연): useDeleteProductsMutation
  const remove = () => {
    setRemoved((prev) => ({ ...prev, ...Object.fromEntries([...sel].map((id) => [id, true])) }));
    toast(`${sel.size}개 상품을 삭제했어요`); setSel(new Set()); setDel(false);
  };

  return (
    <div>
      <PageHead title="상품 조회/수정" desc="판매중지 상품은 쇼핑몰에 노출되지 않습니다. 재고가 0이 되면 자동으로 품절 처리됩니다."
        right={<><button className="btn btn-line btn-sm">엑셀 일괄등록</button><Link to="/seller/products/new" className="btn btn-ink btn-sm">+ 상품 등록</Link></>} />

      <div className="panel p-4 flex flex-wrap items-center gap-3">
        <Segments items={STATUS_TABS} value={status} onChange={setStatus} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="상품명 · 카테고리 · 상태 검색" className="ml-auto sm:w-72" />
      </div>

      <div className="panel mt-3 border-b-0">
        <div className="flex flex-wrap items-center gap-2 px-4 h-12 text-[13px]">
          <Checkbox checked={allOn} onChange={(on) => setSel(on ? new Set(list.map((r) => r.id)) : new Set())} />
          <span className="text-ink-2 mr-2">선택 <b className="num text-ink">{sel.size}</b>개</span>
          <button disabled={!sel.size} onClick={() => bulk('판매중')} className="btn btn-line btn-xs">판매재개</button>
          <button disabled={!sel.size} onClick={() => bulk('판매중지')} className="btn btn-line btn-xs">판매중지</button>
          <button disabled={!sel.size} onClick={() => setDel(true)} className="btn btn-line btn-xs text-rust">삭제</button>
          <span className="ml-auto text-mute">총 {list.length}건</span>
        </div>
      </div>
      <DataTable table={table} loading={isLoading} error={isError} />

      <Modal open={del} onClose={() => setDel(false)} title="상품 삭제" width={420}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setDel(false)}>취소</button><button className="btn btn-sm bg-rust text-white border-rust" onClick={remove}>삭제</button></>}>
        <p className="text-[14px]">선택한 <b>{sel.size}개</b> 상품을 삭제할까요?</p>
        <p className="text-[13px] text-mute mt-2">진행 중인 주문이 있는 상품은 삭제할 수 없으며 판매중지 처리됩니다. 삭제된 상품의 리뷰는 보존됩니다.</p>
      </Modal>
    </div>
  );
}
