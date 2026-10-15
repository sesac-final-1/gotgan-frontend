import { useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/react-table';

// 받아온 목록 안에서 검색 · 정렬 · 페이징 (서버 요청 없음) — 데모 규모 목록용 (컨벤션 4-7)
// 규칙: data · columnFilters 는 호출하는 쪽에서 useMemo, columns 는 모듈 스코프 상수(또는 useMemo)
//
// 검색: 문자열 · 숫자 값을 가진 열에서 대소문자 구분 없이 부분 일치. 날짜 열은 자동 제외
//      (검색에 넣으려면 accessorFn 이 문자열을 돌려주게, 빼려면 meta: { search: false })
function globalFilterFn(row, columnId, filterValue) {
  const q = String(filterValue).trim().toLowerCase();
  if (!q) return true;
  return String(row.getValue(columnId) ?? '').toLowerCase().includes(q);
}

function canGlobalFilter(column) {
  if (column.columnDef.meta?.search === false) return false;
  return true; // 값 타입(문자열 · 숫자) 확인은 TanStack 기본 동작에 맡기지 않고 globalFilterFn 에서 문자열로 비교
}

export function useClientTable({ data, columns, columnFilters, initialSorting = [], pageSize = 20 }) {
  const [sorting, setSorting] = useState(initialSorting);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination, ...(columnFilters ? { columnFilters } : {}) },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn,
    getColumnCanGlobalFilter: canGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true, // 검색어 · 탭이 바뀌면 1페이지로
    sortDescFirst: false, // 열 종류와 상관없이 첫 클릭 = 오름차순 → 내림차순 → 해제 (TanStack 기본은 숫자 열만 내림차순 먼저)
  });

  return { table, globalFilter, setGlobalFilter };
}
