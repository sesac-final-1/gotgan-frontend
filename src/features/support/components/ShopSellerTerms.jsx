// 판매자 이용약관 — 시연용 정적 문서 (법적 효력 없음)
import { SELLER_TERMS } from '@/features/support/data/policy';

export default function ShopSellerTerms() {
  return (
    <div className="max-w-[860px] mx-auto px-4 md:px-6 pt-10">
      <div className="eyebrow">Terms</div>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">판매자 이용약관</h1>
      <p className="mt-4 border border-point p-4 text-[13px] text-point">팀 프로젝트 시연용 문서로 법적 효력이 없습니다.</p>
      <ol className="mt-8 space-y-8">
        {SELLER_TERMS.map((t, i) => (
          <li key={t.title}>
            <h2 className="text-[16px] font-bold">제{i + 1}조 ({t.title})</h2>
            <ol className="mt-2 space-y-1.5 text-[14px] text-ink-2 leading-relaxed">
              {t.body.map((b, k) => <li key={b}>{t.body.length > 1 && `${k + 1}. `}{b}</li>)}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
