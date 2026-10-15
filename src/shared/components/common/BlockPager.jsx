import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cx } from '@/shared/utils/format';

const BLOCK = 10; // 한 번에 보이는 페이지 번호 수

function PagerButton({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="w-8 h-8 flex items-center justify-center hover:bg-sand disabled:opacity-30 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}

// 블록 페이저: << (이전 10페이지 묶음) · < (이전 페이지) · 1~10 · > (다음 페이지) · >> (다음 묶음 첫 페이지, 10 → 11)
// pageIndex 는 0부터. 클라이언트 페이징 · 서버 페이징(manualPagination) 모두 같은 화면 (컨벤션 4-7)
export function BlockPager({ pageIndex, pageCount, onPage, className = '' }) {
  if (pageCount <= 1) return null;
  const blockStart = Math.floor(pageIndex / BLOCK) * BLOCK;
  const blockEnd = Math.min(blockStart + BLOCK, pageCount);
  const go = (i) => onPage(Math.max(0, Math.min(pageCount - 1, i)));
  return (
    <nav className={cx('flex items-center justify-center gap-1 text-[13px]', className)} aria-label="페이지">
      <PagerButton label="이전 10페이지" disabled={blockStart === 0} onClick={() => go(blockStart - BLOCK)}><ChevronsLeft size={16} /></PagerButton>
      <PagerButton label="이전 페이지" disabled={pageIndex === 0} onClick={() => go(pageIndex - 1)}><ChevronLeft size={16} /></PagerButton>
      {Array.from({ length: blockEnd - blockStart }, (_, k) => blockStart + k).map((i) => (
        <button key={i} type="button" onClick={() => go(i)} aria-current={i === pageIndex ? 'page' : undefined}
          className={cx('min-w-8 h-8 px-1 num', i === pageIndex ? 'bg-ink text-white font-semibold' : 'hover:bg-sand')}>
          {i + 1}
        </button>
      ))}
      <PagerButton label="다음 페이지" disabled={pageIndex >= pageCount - 1} onClick={() => go(pageIndex + 1)}><ChevronRight size={16} /></PagerButton>
      <PagerButton label="다음 10페이지" disabled={blockEnd >= pageCount} onClick={() => go(blockEnd)}><ChevronsRight size={16} /></PagerButton>
    </nav>
  );
}
