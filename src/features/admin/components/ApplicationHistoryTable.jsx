import { Link } from 'react-router';
import { StatusPill } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useApplicationHistoryQuery } from '@/features/admin/hooks/useApplicationHistoryQuery';
import { ymdhm } from '@/shared/utils/format';

const COLUMNS = [
  { accessorKey: 'at', header: '일시', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' }, cell: ({ getValue }) => ymdhm(getValue()) },
  {
    accessorKey: 'appId', header: '접수번호', meta: { tdClass: 'num text-[12px]' },
    cell: ({ getValue }) => <Link to={`/admin/applications/${getValue()}`} className="hover:underline">{getValue()}</Link>,
  },
  { accessorKey: 'storeName', header: '스토어명', meta: { tdClass: 'font-semibold' } },
  {
    id: 'change', accessorFn: (h) => `${h.from ?? '신규'} → ${h.to}`, header: '상태 변경',
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5">
        {row.original.from ? <StatusPill s={row.original.from} /> : <span className="text-mute text-[12px]">신규</span>}
        <span className="text-mute">→</span>
        <StatusPill s={row.original.to} />
      </span>
    ),
  },
  { accessorKey: 'by', header: '처리자' },
  { accessorKey: 'reason', header: '사유', meta: { tdClass: 'text-ink-2' } },
];

// 입점 신청 상태 변경 이력 (10/15 추가) — 담당 구지훈. TODO(박지연): store_application_history 테이블 + 조회 API
export default function ApplicationHistoryTable() {
  const { data = [], isLoading, isError } = useApplicationHistoryQuery();
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data, columns: COLUMNS, initialSorting: [{ id: 'at', desc: true }] });
  return (
    <div>
      <div className="flex justify-end mb-3">
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="접수번호 · 스토어 · 처리자 · 사유" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="이력이 없어요" />
    </div>
  );
}
