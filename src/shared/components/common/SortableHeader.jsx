import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cx } from '@/shared/utils/format';

// 정렬 헤더 — 클릭할 때마다 오름차순 → 내림차순 → 해제 (컨벤션 4-7). 목업 .tbl 의 th 스타일 그대로
export function SortableHeader({ header }) {
  const col = header.column;
  const label = typeof col.columnDef.header === 'string' ? col.columnDef.header : null;
  if (!col.getCanSort()) {
    return <th className={col.columnDef.meta?.thClass}>{label}</th>;
  }
  const dir = col.getIsSorted(); // 'asc' | 'desc' | false
  const Icon = dir === 'asc' ? ChevronUp : dir === 'desc' ? ChevronDown : ChevronsUpDown;
  return (
    <th className={col.columnDef.meta?.thClass} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" onClick={col.getToggleSortingHandler()} className={cx('inline-flex items-center gap-0.5 hover:text-ink', dir && 'text-ink')}>
        {label}
        <Icon size={13} strokeWidth={dir ? 2.2 : 1.6} className={dir ? '' : 'text-line-2'} />
      </button>
    </th>
  );
}
