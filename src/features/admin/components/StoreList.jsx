// 스토어 관리 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Download } from 'lucide-react';
import { PageHead, Segments, StatusPill } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminStoreListQuery } from '@/features/admin/hooks/useAdminStoreListQuery';
import { ymd } from '@/shared/utils/format';

const TABS = ['전체', '운영중', '정지'];
const NUM = { thClass: 'text-right', tdClass: 'text-right num', search: false };

const COLUMNS = [
  {
    accessorKey: 'name', header: '스토어',
    cell: ({ row }) => (
      <Link to={`/admin/stores/${row.original.id}`} className="flex items-center gap-2 font-semibold hover:underline">
        <span className="w-7 h-7 bg-ink text-white text-[12px] font-bold flex items-center justify-center">{row.original.name[0]}</span>{row.original.name}
      </Link>
    ),
  },
  { accessorKey: 'owner', header: '대표자' },
  { accessorKey: 'bizNo', header: '사업자번호', meta: { tdClass: 'num text-ink-2' } },
  { accessorKey: 'grade', header: '등급' },
  { accessorKey: 'avg', header: '평점', sortUndefined: 'last', meta: { search: false },
    cell: ({ row }) => (row.original.reviewCount ? `★ ${row.original.avg.toFixed(1)} (${row.original.reviewCount})` : <span className="text-mute">리뷰 없음</span>) },
  { accessorKey: 'since', header: '입점일', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2', search: false }, cell: ({ getValue }) => ymd(getValue()) },
  { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
];

// 스토어 목록 — 전체 1회 로드 후 화면에서 탭 · 검색 · 정렬 · 페이징 (컨벤션 4-7). 폐점은 '전체' 에만
export default function StoreList() {
  const [tab, setTab] = useState('전체');
  const { data: stores = [], isLoading, isError } = useAdminStoreListQuery();

  const columnFilters = useMemo(() => (tab === '전체' ? [] : [{ id: 'status', value: tab }]), [tab]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: stores, columns: COLUMNS, columnFilters });
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t, t === '전체' ? stores.length : stores.filter((s) => s.status === t).length])),
    [stores],
  );

  return (
    <div>
      <PageHead title="스토어 관리" desc="입점 승인된 스토어 목록 · 등급은 최근 3개월 거래액과 페널티 점수로 매월 1일 갱신" right={<button className="btn btn-line btn-sm"><Download size={14} /> 엑셀</button>} />
      <div className="flex flex-wrap gap-3 items-center">
        <Segments items={TABS} value={tab} onChange={setTab} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="스토어명 · 대표자 · 사업자번호" className="ml-auto" />
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} />
      </div>
    </div>
  );
}
