import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHead, StatusPill, Segments } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { ymdhm } from '@/shared/utils/format';

const STATUS_TABS = ['전체', '심사대기', '보완요청', '승인', '반려'];
// 전체 처리 이력 탭은 없음 — 신청별 이력은 상세에 (store.md 10/26 정리 2번). 서류는 목록 응답에 없어 상세에서 확인
// 카테고리 이름은 admin-service 가 붙여 준 categoryName — 열 정의는 상태가 없어 모듈 상수
const COLUMNS = [
  { accessorKey: 'no', header: '접수번호', meta: { tdClass: 'num text-[12px]' } },
  { accessorKey: 'storeName', header: '스토어명', meta: { tdClass: 'font-semibold' } },
  { accessorKey: 'owner', header: '대표자' },
  { accessorKey: 'catName', header: '카테고리' },
  { accessorKey: 'bizType', header: '구분' },
  { accessorKey: 'expected', header: '월 예상매출' },
  {
    accessorKey: 'applied', header: '신청일시', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' },
    cell: ({ getValue }) => ymdhm(getValue()),
  },
  { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
  {
    id: 'action', header: '', enableSorting: false, meta: { search: false },
    cell: ({ row }) => (
      <Link to={`/admin/applications/${row.original.id}`} className="btn btn-line btn-xs">
        {row.original.status === '심사대기' ? '심사하기' : '보기'}
      </Link>
    ),
  },
];

// 입점 심사 목록 — 담당 구지훈. 전체 1회 로드 후 화면에서 탭 · 검색 · 정렬 · 페이징 (서버 요청 없음, 컨벤션 4-7)
export default function ApplicationList() {
  const [tab, setTab] = useState('전체');
  const { data: apps = [], isLoading, isError } = useApplicationsQuery();
  const columnFilters = useMemo(() => (tab === '전체' ? [] : [{ id: 'status', value: tab }]), [tab]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({
    data: apps,
    columns: COLUMNS,
    columnFilters,
    initialSorting: [{ id: 'applied', desc: true }],
  });

  const counts = useMemo(
    () => Object.fromEntries(STATUS_TABS.map((t) => [t, t === '전체' ? apps.length : apps.filter((a) => a.status === t).length])),
    [apps],
  );

  return (
    <div>
      <PageHead title="입점 심사" desc="심사 기준: 사업자 상태(국세청) · 통신판매업 신고 · 카테고리 적합성 · 중복 입점 여부 / 처리 기한: 접수 후 영업일 3일" />
      <div className="flex flex-wrap gap-3 items-center">
        <Segments items={STATUS_TABS} value={tab} onChange={setTab} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="접수번호 · 스토어 · 대표자 · 카테고리" className="ml-auto" />
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} />
      </div>
    </div>
  );
}
