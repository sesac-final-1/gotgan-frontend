// 판매자 상품 조회/수정 — 담당 박지연
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Eye, Copy } from 'lucide-react';
import { PageHead, Segments, StatusPill, Checkbox, Modal } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useSellerProductsQuery } from '@/features/product/hooks/useSellerProductsQuery';
import { useUpdateSellerProductStatusMutation, useDeleteSellerProductsMutation, useCopySellerProductMutation } from '@/features/product/hooks/useSellerProductMutations';
import SellerStockModal from '@/features/product/components/SellerStockModal';
import { bulkResultMessage } from '@/features/product/sellerProductList';
import { useRatedProducts } from '@/features/product/hooks/useRatedProducts';
import { toast } from '@/shared/stores/toastStore';
import { comma, ymd, cx } from '@/shared/utils/format';

const STATUS_TABS = ['전체', '판매중', '품절', '판매중지'];

// 열 정의는 선택 상태가 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ sel, toggle, onStock, onCopy }) {
  return [
    {
      id: 'select', header: '', enableSorting: false, meta: { thClass: 'w-10', search: false },
      cell: ({ row }) => <Checkbox checked={sel.has(row.original.id)} onChange={() => toggle(row.original.id)} />,
    },
    {
      accessorKey: 'name', header: '상품',
      cell: ({ row: { original: p } }) => (
        <div className="flex items-center gap-3 min-w-[260px]">
          {p.images[0] ? <img src={p.images[0]} alt="" className="w-11 h-11 object-cover" /> : <div className="w-11 h-11 bg-sand" />}
          <div><Link to={`/seller/products/${p.id}/edit`} className="font-medium hover:underline">{p.name}</Link><div className="text-[11.5px] text-mute num">상품번호 {p.id}</div></div>
        </div>
      ),
    },
    { id: 'cat', accessorFn: (p) => `${p.catName} > ${p.sub}`, header: '카테고리', meta: { tdClass: 'text-ink-2 whitespace-nowrap' } },
    { accessorKey: 'price', header: '판매가', meta: { thClass: 'text-right', tdClass: 'text-right num' }, cell: ({ getValue }) => comma(getValue()) },
    {
      id: 'sale', accessorFn: (p) => (p.discount ? p.salePrice : 0), header: '할인가', meta: { thClass: 'text-right', tdClass: 'text-right num' },
      cell: ({ row: { original: p } }) => (p.discount ? <><span className="text-point">{Math.round(p.discount * 100)}%</span> {comma(p.salePrice)}</> : '-'),
    },
    {
      accessorKey: 'stock', header: '재고', meta: { thClass: 'text-right', tdClass: 'text-right num' },
      cell: ({ getValue }) => <span className={cx(getValue() < 20 && 'text-rust font-bold')}>{comma(getValue())}</span>,
    },
    {
      accessorKey: 'status', header: '상태', filterFn: 'equals', meta: { tdClass: 'whitespace-nowrap' },
      cell: ({ row: { original: p } }) => (
        <>
          <StatusPill s={p.pill} />
          {p.blocked && p.statusReason && <div className="text-[11.5px] text-rust mt-1 max-w-[180px] whitespace-normal">사유: {p.statusReason}</div>}
          {p.hidden && <div className="text-[11.5px] text-amber mt-1">쇼핑몰 미노출 · {p.hidden}</div>}
        </>
      ),
    },
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
          <button onClick={() => onStock(p.id)} className="btn btn-line btn-xs">재고</button>
          <Link to={`/products/${p.id}`} className="btn btn-ghost btn-xs px-1.5" title="쇼핑몰에서 보기"><Eye size={14} /></Link>
          <button onClick={() => onCopy(p.id)} className="btn btn-ghost btn-xs px-1.5" title="복사"><Copy size={14} /></button>
        </div>
      ),
    },
  ];
}

// 판매자 상품은 데모 규모라 전체 1회 로드 후 화면에서 탭 · 검색 · 정렬 · 페이징 (컨벤션 4-7)
const NO_PRODUCTS = []; // 받기 전 기본값도 고정 참조 — 렌더마다 새 [] 면 useRatedProducts 가 매번 새 목록을 만든다

export default function SellerProductList() {
  const { data: products = NO_PRODUCTS, isLoading, isError } = useSellerProductsQuery();
  const rows = useRatedProducts(products);
  const updateStatus = useUpdateSellerProductStatusMutation();
  const deleteProducts = useDeleteSellerProductsMutation();
  const { mutate: copyProduct } = useCopySellerProductMutation(); // mutate 는 렌더마다 같은 함수라 열 정의를 다시 만들지 않음
  const [stockId, setStockId] = useState(null); // 재고 수정 모달을 연 상품
  const [status, setStatus] = useState('전체');
  const [sel, setSel] = useState(() => new Set());
  const [del, setDel] = useState(false);

  const toggle = useCallback((id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  // 복사 — 상세를 읽어 판매중지 · 재고 0 으로 새로 등록(12절), 목록은 무효화로 갱신
  const onCopy = useCallback((id) => copyProduct(id, {
    onSuccess: () => toast('판매중지 상태로 복사했어요. 재고를 채운 뒤 판매를 시작하세요'),
    onError: (err) => toast(err.response?.data?.message ?? '복사하지 못했어요. 잠시 후 다시 시도해 주세요.'),
  }), [copyProduct]);
  const columns = useMemo(() => buildColumns({ sel, toggle, onStock: setStockId, onCopy }), [sel, toggle, onCopy]);
  const columnFilters = useMemo(() => (status === '전체' ? [] : [{ id: 'status', value: status }]), [status]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: rows, columns, columnFilters, initialSorting: [{ id: 'created', desc: true }] });

  const counts = { 전체: rows.length, 판매중: 0, 품절: 0, 판매중지: 0 };
  rows.forEach((r) => counts[r.status]++);
  const list = table.getFilteredRowModel().rows.map((r) => r.original);
  const allOn = list.length > 0 && list.every((r) => sel.has(r.id));
  const busy = updateStatus.isPending || deleteProducts.isPending;
  // 건마다 처리 결과가 온다 — 실패한 상품은 선택에 남겨 다시 볼 수 있게 (강제중지 상품 재개 등)
  const report = (verb, soldOutIds) => ({ success, failed }) => {
    toast(bulkResultMessage({ verb, success, failed, soldOutIds }));
    setSel(new Set(failed.map((f) => f.productId)));
  };
  const fail = (err) => toast(err.response?.data?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  const bulk = (st) => {
    const soldOutIds = st === '판매중' ? rows.filter((r) => sel.has(r.id) && r.stock === 0).map((r) => r.id) : [];
    updateStatus.mutate({ productIds: [...sel], status: st }, { onSuccess: report(st === '판매중' ? '판매재개했어요' : '판매중지했어요', soldOutIds), onError: fail });
  };
  const remove = () => deleteProducts.mutate([...sel], { onSuccess: report('삭제했어요'), onError: fail, onSettled: () => setDel(false) });

  return (
    <div>
      <PageHead title="상품 조회/수정" desc="판매중지 상품은 쇼핑몰에 노출되지 않습니다. 재고가 0이 되면 자동으로 품절 처리됩니다."
        right={<Link to="/seller/products/new" className="btn btn-ink btn-sm">+ 상품 등록</Link>} />

      <div className="panel p-4 flex flex-wrap items-center gap-3">
        <Segments items={STATUS_TABS} value={status} onChange={setStatus} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="상품명 · 카테고리 · 상태 검색" className="ml-auto sm:w-72" />
      </div>

      <div className="panel mt-3 border-b-0">
        <div className="flex flex-wrap items-center gap-2 px-4 h-12 text-[13px]">
          <Checkbox checked={allOn} onChange={(on) => setSel(on ? new Set(list.map((r) => r.id)) : new Set())} />
          <span className="text-ink-2 mr-2">선택 <b className="num text-ink">{sel.size}</b>개</span>
          <button disabled={!sel.size || busy} onClick={() => bulk('판매중')} className="btn btn-line btn-xs">판매재개</button>
          <button disabled={!sel.size || busy} onClick={() => bulk('판매중지')} className="btn btn-line btn-xs">판매중지</button>
          <button disabled={!sel.size || busy} onClick={() => setDel(true)} className="btn btn-line btn-xs text-rust">삭제</button>
          <span className="ml-auto text-mute">총 {list.length}건</span>
        </div>
      </div>
      <DataTable table={table} loading={isLoading} error={isError} />

      <SellerStockModal productId={stockId} onClose={() => setStockId(null)} />
      <Modal open={del} onClose={() => setDel(false)} title="상품 삭제" width={420}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setDel(false)}>취소</button><button disabled={busy} className="btn btn-sm bg-rust text-white border-rust" onClick={remove}>삭제</button></>}>
        <p className="text-[14px]">선택한 <b>{sel.size}개</b> 상품을 삭제할까요?</p>
        <p className="text-[13px] text-mute mt-2">삭제한 상품은 쇼핑몰 · 장바구니에서 구매할 수 없게 돼요. 지난 주문과 리뷰는 그대로 남아요.</p>
      </Modal>
    </div>
  );
}
