// 스토어 관리 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { PageHead, Segments, StatusPill, Spark } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { ratingSummary } from '@/features/review/utils/ratingSummary';
import { ymd, shortWon } from '@/shared/utils/format';

const TABS = ['전체', '운영중', '정지'];
const NUM = { thClass: 'text-right', tdClass: 'text-right num', search: false };

const COLUMNS = [
  {
    accessorKey: 'name', header: '스토어',
    cell: ({ row }) => (
      <Link to={`/admin/stores/${row.original.id}`} className="flex items-center gap-2 font-semibold hover:underline">
        <span className="w-7 h-7 text-white text-[12px] font-bold flex items-center justify-center" style={{ background: row.original.color }}>{row.original.name[0]}</span>{row.original.name}
      </Link>
    ),
  },
  { accessorKey: 'owner', header: '대표자' },
  { accessorKey: 'catName', header: '카테고리', meta: { tdClass: 'text-ink-2' } },
  { accessorKey: 'grade', header: '등급' },
  { accessorKey: 'prodCount', header: '상품', meta: NUM },
  { accessorKey: 'gross8', header: '8주 거래액', meta: NUM, cell: ({ getValue }) => `${shortWon(getValue())}원` },
  { id: 'spark', header: '추이', enableSorting: false, meta: { search: false }, cell: ({ row }) => <Spark values={row.original.spark} /> },
  { accessorKey: 'avg', header: '평점', meta: { search: false }, cell: ({ getValue }) => `★ ${getValue().toFixed(1)}` },
  { accessorKey: 'since', header: '입점일', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2', search: false }, cell: ({ getValue }) => ymd(getValue()) },
  { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
];

// 스토어 목록 — 전체 1회 로드 후 화면에서 탭 · 검색 · 정렬 · 페이징 (컨벤션 4-7)
export default function StoreList() {
  const [tab, setTab] = useState('전체');
  const { data: stores = [], isLoading, isError } = useAdminStoresQuery();
  const { data: settlements = [] } = useAdminSettlementsQuery();
  const { data: reviews = [] } = useAdminReviewsQuery();
  const { data: categories = [] } = useAdminCategoriesQuery();
  const { data: products = [] } = useAdminProductsQuery();

  const rows = useMemo(() => {
    const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    return stores.map((s) => {
      const ss = settlements.filter((x) => x.storeId === s.id);
      return {
        ...s,
        catName: catName[s.cat] ?? s.cat,
        prodCount: products.filter((p) => p.storeId === s.id).length,
        gross8: ss.reduce((a, x) => a + x.gross, 0),
        spark: ss.map((x) => x.gross).reverse(),
        avg: ratingSummary(reviews.filter((r) => r.storeId === s.id)).avg,
      };
    });
  }, [stores, settlements, reviews, categories, products]);
  const columnFilters = useMemo(() => (tab === '전체' ? [] : [{ id: 'status', value: tab }]), [tab]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: rows, columns: COLUMNS, columnFilters });
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t, t === '전체' ? stores.length : stores.filter((s) => s.status === t).length])),
    [stores],
  );

  return (
    <div>
      <PageHead title="스토어 관리" desc="입점 승인된 스토어 목록 · 등급은 최근 3개월 거래액과 페널티 점수로 매월 1일 갱신" right={<button className="btn btn-line btn-sm"><Download size={14} /> 엑셀</button>} />
      <div className="flex flex-wrap gap-3 items-center">
        <Segments items={TABS} value={tab} onChange={setTab} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="스토어명 · 대표자" className="ml-auto" />
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} />
      </div>
    </div>
  );
}
