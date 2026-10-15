// 회원 관리 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHead, Segments, StatusPill, GradeBadge } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { GRADES } from '@/features/user/constants';
import { comma, ymd } from '@/shared/utils/format';

const TABS = ['전체', '정상', '휴면', '이용정지'];
const GRADE_TABS = ['전체', ...GRADES.map((g) => g.id)];
const NUM = { thClass: 'text-right', tdClass: 'text-right num', search: false };
const DATE = { tdClass: 'num text-ink-2', search: false };

const COLUMNS = [
  {
    accessorKey: 'name', header: '회원',
    cell: ({ row }) => <Link to={`/admin/users/${row.original.id}`} className="flex items-center gap-2 font-semibold hover:underline"><img src={row.original.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />{row.original.name}</Link>,
  },
  { accessorKey: 'email', header: '이메일', meta: { tdClass: 'text-ink-2' } },
  { accessorKey: 'grade', header: '등급', cell: ({ getValue }) => <GradeBadge grade={getValue()} /> },
  { accessorKey: 'orders', header: '주문', meta: NUM },
  { accessorKey: 'spent', header: '누적 구매확정', meta: NUM, cell: ({ getValue }) => comma(getValue()) },
  { accessorKey: 'point', header: '보유 포인트', meta: NUM, cell: ({ getValue }) => `${comma(getValue())}P` },
  { accessorKey: 'joined', header: '가입일', sortingFn: 'datetime', meta: DATE, cell: ({ getValue }) => ymd(getValue()) },
  { accessorKey: 'lastLogin', header: '최근 접속', sortingFn: 'datetime', meta: DATE, cell: ({ getValue }) => ymd(getValue()) },
  { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
];

// 회원 목록 — 상태 · 등급 탭은 columnFilters, 검색 · 정렬 · 페이징은 화면에서 (컨벤션 4-7)
export default function UserList() {
  const [tab, setTab] = useState('전체');
  const [grade, setGrade] = useState('전체');
  const { data: users = [], isLoading, isError } = useAdminUsersQuery();
  const columnFilters = useMemo(() => [
    ...(tab === '전체' ? [] : [{ id: 'status', value: tab }]),
    ...(grade === '전체' ? [] : [{ id: 'grade', value: grade }]),
  ], [tab, grade]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: users, columns: COLUMNS, columnFilters });
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t, t === '전체' ? users.length : users.filter((u) => u.status === t).length])),
    [users],
  );
  const gCounts = useMemo(
    () => Object.fromEntries(GRADE_TABS.map((g) => [g, g === '전체' ? users.length : users.filter((u) => u.grade === g).length])),
    [users],
  );

  return (
    <div>
      <PageHead title="회원 관리" desc="회원등급은 누적 구매확정 금액 기준 (NORMAL · SILVER 30만원 · GOLD 80만원) · 포인트 적립률 5%" />
      <div className="flex flex-wrap gap-3 items-center">
        <Segments items={TABS} value={tab} onChange={setTab} counts={counts} />
        <Segments items={GRADE_TABS} value={grade} onChange={setGrade} counts={gCounts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="이름 · 이메일" className="ml-auto" />
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} />
      </div>
    </div>
  );
}
