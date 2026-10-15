import { flexRender } from '@tanstack/react-table';
import { SortableHeader } from '@/shared/components/common/SortableHeader';
import { BlockPager } from '@/shared/components/common/BlockPager';
import { cx } from '@/shared/utils/format';

// 목업 .panel + .tbl 표를 TanStack Table 로 그린다 — 디자인 그대로, 정렬 헤더 · 블록 페이저 포함
// 열 정의 meta: { thClass, tdClass, search(false 면 검색 제외) } · 정렬/검색 값과 표시가 다르면 accessorFn(값) + cell(표시) 분리
// 로딩 · 에러 · 빈 상태는 tbody 안의 행 하나 — 검색창이 사라졌다 생기며 포커스를 잃지 않게 (컨벤션 4-7)
export function DataTable({ table, loading = false, error = null, empty = '조건에 맞는 항목이 없어요', className = '' }) {
  const colSpan = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const { pageIndex } = table.getState().pagination;
  return (
    <>
      <div className={cx('panel overflow-x-auto', className)}>
        <table className="tbl">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>{hg.headers.map((h) => <SortableHeader key={h.id} header={h} />)}</tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="text-center text-mute py-10">불러오는 중…</td></tr>
            ) : error ? (
              <tr><td colSpan={colSpan} className="text-center text-rust py-10">목록을 불러오지 못했어요</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="text-center text-mute py-10">{empty}</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cell.column.columnDef.meta?.tdClass}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <BlockPager className="mt-4" pageIndex={pageIndex} pageCount={table.getPageCount()} onPage={(i) => table.setPageIndex(i)} />
    </>
  );
}
