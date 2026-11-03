// 펼치기 목록 — 공지사항 · 자주 묻는 질문 공용 (고객센터 FAQ 목록과 같은 모양). items: [{ key, side, title, body }]
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '@/shared/utils/format';

export default function AccordionList({ items }) {
  const [open, setOpen] = useState(-1);
  return (
    <ul className="border-t border-line">
      {items.map((it, i) => (
        <li key={it.key} className="border-b border-line">
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center gap-4 py-5 text-left">
            <span className="w-24 shrink-0 text-[12px] text-mute num">{it.side}</span>
            <span className="flex-1 font-medium">{it.title}</span>
            <ChevronDown size={18} className={cx('transition-transform shrink-0', open === i && 'rotate-180')} />
          </button>
          {open === i && <p className="pb-5 pl-28 pr-6 text-[14px] text-ink-2 leading-relaxed">{it.body}</p>}
        </li>
      ))}
    </ul>
  );
}
