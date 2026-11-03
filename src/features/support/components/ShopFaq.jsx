// 자주 묻는 질문 — 구매자 · 판매자 탭 (프론트 정적 데이터, 고객센터 FAQ 와 같은 모양)
import { useState } from 'react';
import { Link } from 'react-router';
import AccordionList from '@/features/support/components/AccordionList';
import { FAQ_TABS } from '@/features/support/data/policy';
import { cx } from '@/shared/utils/format';

export default function ShopFaq() {
  const [tab, setTab] = useState(FAQ_TABS[0].key);
  const current = FAQ_TABS.find((t) => t.key === tab);
  return (
    <div className="max-w-[860px] mx-auto px-4 md:px-6 pt-10">
      <div className="eyebrow">FAQ</div>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">자주 묻는 질문</h1>
      <div role="tablist" className="mt-6 flex gap-1.5 py-4">
        {FAQ_TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cx('h-8 px-4 text-[13px] border', tab === t.key ? 'border-ink bg-ink text-white' : 'border-line-2 text-ink-2 hover:border-ink')}>{t.label}</button>
        ))}
      </div>
      {/* 탭마다 새로 그려 펼친 항목을 닫는다 */}
      <AccordionList key={tab} items={current.items.map((f) => ({ key: f.q, side: f.cat, title: f.q, body: f.a }))} />
      <p className="mt-8 text-[13px] text-ink-2">
        찾는 답이 없으면 <Link to="/help" className="underline">고객센터</Link>에서 운영팀과 채팅으로 물어보세요.
        {tab === 'seller' && <> 요율은 <Link to="/fees" className="underline">수수료 안내</Link>에서 볼 수 있어요.</>}
      </p>
    </div>
  );
}
