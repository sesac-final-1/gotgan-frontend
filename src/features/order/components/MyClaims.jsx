// 마이페이지 클레임 내역 — 담당 이경석. 전체 1회 로드 후 화면에서 유형 탭 · 검색 · 정렬 · 페이징 (컨벤션 4-7)
// 목업의 행 펼침(상세) 은 DataTable 에 펼침 행이 없어 같은 내용을 모달로 띄운다
import { useMemo, useState } from 'react';
import { StatusPill, Segments, Modal } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useMyOrdersMockQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import MyRefundBox from '@/features/order/components/MyRefundBox';
import { toMap } from '@/shared/utils/collection';
import { ymd } from '@/shared/utils/format';

const TYPES = ['전체', '취소', '반품', '교환'];

function buildColumns(onOpen) {
  return [
    {
      id: 'product', accessorFn: (l) => `${l.product?.name ?? ''} ${l.option}`, header: '상품',
      cell: ({ row }) => (
        <div className="flex items-center gap-3 py-1.5"><img src={row.original.product?.images[0]} alt="" className="w-12 h-14 object-cover" /><span className="font-medium">{row.original.product?.name}<br /><span className="text-mute font-normal">{row.original.option}</span></span></div>
      ),
    },
    { id: 'type', accessorFn: (l) => l.claim.type, header: '유형' },
    { id: 'reason', accessorFn: (l) => l.claim.reason, header: '사유', meta: { thClass: 'hidden sm:table-cell', tdClass: 'text-ink-2 hidden sm:table-cell' } },
    {
      id: 'requested', accessorFn: (l) => l.claim.requested, header: '신청일', sortingFn: 'datetime', meta: { thClass: 'hidden sm:table-cell', tdClass: 'num hidden sm:table-cell' },
      cell: ({ getValue }) => ymd(getValue()),
    },
    { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    {
      id: 'action', header: '', enableSorting: false, meta: { search: false, tdClass: 'text-right' },
      cell: ({ row }) => <button onClick={() => onOpen(row.original)} className="btn btn-line btn-xs">상세</button>,
    },
  ];
}

export default function MyClaims() {
  const [type, setType] = useState('전체');
  const [open, setOpen] = useState(null);
  const { data: orders = [], isLoading, isError } = useMyOrdersMockQuery();
  const { data: products = [] } = useProductsQuery();
  const { data: stores = [] } = useStoresQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const storeById = useMemo(() => toMap(stores), [stores]);
  // 클레임이 있는 상품주문 (상품 · 주문 정보를 붙여 둔다)
  const lines = useMemo(
    () => orders.flatMap((o) => o.items.filter((l) => l.claim).map((l) => ({ ...l, order: o, product: productById[l.productId] }))),
    [orders, productById],
  );
  const counts = useMemo(() => {
    const c = { 전체: lines.length, 취소: 0, 반품: 0, 교환: 0 };
    lines.forEach((l) => { c[l.claim.type] += 1; });
    return c;
  }, [lines]);
  const columns = useMemo(() => buildColumns(setOpen), []);
  const columnFilters = useMemo(() => (type === '전체' ? [] : [{ id: 'type', value: type }]), [type]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({
    data: lines,
    columns,
    columnFilters,
    initialSorting: [{ id: 'requested', desc: true }],
  });
  const done = open?.status.endsWith('완료');

  return (
    <div>
      <MyPageHead>취소 · 반품 · 교환</MyPageHead>
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <Segments items={TYPES} value={type} onChange={setType} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="상품 · 옵션 · 사유" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="신청한 클레임이 없어요" />
      <div className="mt-6 bg-cream p-5 text-[13px] text-ink-2 leading-relaxed">
        <b className="text-ink">처리 안내</b><br />
        · 결제완료 상태: 즉시 취소 · 배송준비 상태: 판매자 승인 후 취소<br />
        · 반품/교환: 배송완료 후 7일 이내 신청 가능 · 구매확정 후에는 신청 불가<br />
        · 취소 · 반품 완료 시 그 상품주문분 사용 포인트는 환원, 적립 포인트는 회수됩니다.
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.claim.type} 상세` : ''} width={560}
        footer={<button className="btn btn-line btn-sm" onClick={() => setOpen(null)}>닫기</button>}>
        {open && (
          <div className="space-y-4">
            <div className="text-[13px] space-y-1.5">
              <div><span className="text-mute w-24 inline-block">상품주문번호</span><span className="num">{open.lineId}</span></div>
              <div><span className="text-mute w-24 inline-block">사유</span>{open.claim.reason}{open.claim.detail && ` · ${open.claim.detail}`}</div>
              <div><span className="text-mute w-24 inline-block">신청일</span><span className="num">{ymd(open.claim.requested)}</span></div>
              <div><span className="text-mute w-24 inline-block">처리 상태</span>{done ? `${open.claim.type} 처리 완료` : '판매자 확인 중'}</div>
            </div>
            <div>
              <MyRefundBox order={open.order} line={open} type={open.claim.type} reason={open.claim.reason} store={storeById[open.storeId]} />
              {open.claim.type !== '교환' && <p className="text-[12px] text-mute mt-2">{done ? '사용 포인트는 환원되고, 이 상품주문분 적립 포인트는 회수되었어요.' : '처리 완료 시 사용 포인트 환원 · 적립 포인트 회수가 함께 진행돼요.'}</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
