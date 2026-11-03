// 수수료 안내 — 판매자용 공개 화면 (프론트 정적 데이터, 판매수수료는 시드값)
import { Link } from 'react-router';
import { COMMISSION_RATES, FEE_EXAMPLE, PAYMENT_FEE_LABEL, payoutOf } from '@/features/support/data/policy';
import { pct, won } from '@/shared/utils/format';

const EX = payoutOf(FEE_EXAMPLE.sales, FEE_EXAMPLE.rate);

export default function ShopFees() {
  return (
    <div className="max-w-[860px] mx-auto px-4 md:px-6 pt-10">
      <div className="eyebrow">Fees</div>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight">수수료 안내</h1>
      <p className="mt-2 text-[13px] text-ink-2">판매수수료는 상품의 상위 카테고리 요율을 따르고, 결제수수료 {PAYMENT_FEE_LABEL}가 별도로 붙습니다.</p>

      <h2 className="mt-10 text-[18px] font-bold border-b border-ink pb-3">카테고리별 판매수수료</h2>
      <table className="tbl w-full mt-2">
        <thead><tr><th className="text-left">상위 카테고리</th><th className="text-right">판매수수료</th><th className="text-right">결제수수료</th></tr></thead>
        <tbody>
          {COMMISSION_RATES.map((c) => (
            <tr key={c.name}><td>{c.name}</td><td className="text-right num">{pct(c.rate)}</td><td className="text-right num">{PAYMENT_FEE_LABEL}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-10 text-[18px] font-bold border-b border-ink pb-3">정산 방식</h2>
      <ul className="mt-4 space-y-2 text-[14px] text-ink-2 leading-relaxed">
        <li>· 지급액 = 구매확정 매출 − 판매수수료 − 결제수수료 (각 수수료는 원 단위 내림)</li>
        <li>· 주 1회 정산 — 월요일부터 일요일까지 구매확정된 상품주문을 모아 다음 주 목요일에 지급</li>
        <li>· 이용 정지 · 폐점 스토어의 정산은 자동으로 지급 보류</li>
      </ul>

      <div className="mt-6 border border-ink p-6">
        <div className="eyebrow">Example</div>
        <div className="mt-1.5 font-bold">{FEE_EXAMPLE.category} 상품 {won(FEE_EXAMPLE.sales)} 구매확정</div>
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-[14px]">
          <dt className="text-ink-2">구매확정 매출</dt><dd className="num text-right">{won(FEE_EXAMPLE.sales)}</dd>
          <dt className="text-ink-2">판매수수료 ({pct(FEE_EXAMPLE.rate)})</dt><dd className="num text-right">− {won(EX.commission)}</dd>
          <dt className="text-ink-2">결제수수료 ({PAYMENT_FEE_LABEL})</dt><dd className="num text-right">− {won(EX.paymentFee)}</dd>
          <dt className="font-bold border-t border-line pt-2">지급액</dt><dd className="num text-right font-bold border-t border-line pt-2">{won(EX.payout)}</dd>
        </dl>
      </div>

      <p className="mt-6 text-[13px] text-mute">수수료율은 운영 정책에 따라 바뀔 수 있으며, 변경은 공지 후 적용합니다. 자세한 기준은 <Link to="/terms/seller" className="underline">판매자 이용약관</Link>을 확인해 주세요.</p>
    </div>
  );
}
