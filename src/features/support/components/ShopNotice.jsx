// 공지사항 — 프론트 정적 데이터 (API 없음)
import AccordionList from '@/features/support/components/AccordionList';
import { NOTICES } from '@/features/support/data/policy';

const ITEMS = NOTICES.map((n) => ({ key: n.title, side: n.date, title: `[${n.tag}] ${n.title}`, body: n.body }));

export default function ShopNotice() {
  return (
    <div className="max-w-[860px] mx-auto px-4 md:px-6 pt-10">
      <div className="eyebrow">Notice</div>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">공지사항</h1>
      <p className="mt-2 mb-6 text-[13px] text-ink-2">곳간 이용 · 결제 · 정산 정책 안내입니다.</p>
      <AccordionList items={ITEMS} />
    </div>
  );
}
