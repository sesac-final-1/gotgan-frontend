// 주문 완료 — 담당 이경석. PC 결제는 주문서가 결제 확인까지 마치고 navigate state 로 결과를 넘긴다.
// 모바일은 결제사 페이지에서 ?orderNo=&paymentId=... 로 돌아오므로 여기서 결제 확인을 이어서 부른다 (useRedirectPaymentQuery)
import { Link, useLocation } from 'react-router';
import { Check } from 'lucide-react';
import { useRedirectPaymentQuery } from '@/features/payment/hooks/useRedirectPaymentQuery';
import { earnOf, POINT_RATE } from '@/features/user/constants';
import { Empty } from '@/shared/components/ui';
import { won, comma } from '@/shared/utils/format';

export default function ShopOrderComplete() {
  const { state, search } = useLocation();
  const st = state || {};
  const redirectOrderNo = st.orderNo ? null : new URLSearchParams(search).get('orderNo');
  const { data: redirect, isLoading } = useRedirectPaymentQuery(redirectOrderNo, search);

  if (isLoading) return <Empty title="결제를 확인하고 있어요" />;
  if (redirect && redirect.status !== 'PAID') {
    return <Empty title="결제를 완료하지 못했어요" desc={redirect.message} action={<Link to="/mypage/orders" className="btn btn-ink">주문 내역 보기</Link>} />;
  }
  const orderNo = st.orderNo ?? redirect?.orderNo;
  if (!orderNo) return <Empty title="주문 정보를 찾을 수 없어요" action={<Link to="/mypage/orders" className="btn btn-ink">주문 내역 보기</Link>} />;
  const pay = st.pay ?? redirect.payAmt;

  return (
    <div className="max-w-[640px] mx-auto px-4 pt-20 text-center">
      <div className="mx-auto w-14 h-14 bg-ink text-white flex items-center justify-center"><Check size={28} strokeWidth={2.5} /></div>
      <h1 className="mt-6 text-[26px] font-bold tracking-tight">주문이 완료되었습니다</h1>
      <p className="mt-2 text-sm text-ink-2">판매자가 주문을 확인하면 알림톡으로 알려드려요.</p>
      <div className="mt-10 border-t border-ink text-left text-[14px]">
        {[
          ['주문번호', <span className="num">{orderNo}</span>],
          ['결제수단', st.method || '신용/체크카드'],
          // 리다이렉트로 돌아오면 사용 포인트 · 배송지를 모름 — 주문 상세에서 확인
          st.point != null && ['사용 포인트', <span className="num">{comma(st.point)}P</span>],
          ['실결제금액', <b className="num">{won(pay)}</b>],
          ['적립 예정 포인트', <span className="num text-moss font-semibold">+{comma(st.earn ?? earnOf(pay))}P <span className="text-mute font-normal text-[12px]">실결제금액의 {POINT_RATE * 100}% · 구매확정 시 적립</span></span>],
          st.address && ['배송지', st.address],
        ].filter(Boolean).map(([k, v]) => (
          <div key={k} className="flex py-3.5 border-b border-line"><span className="w-28 text-mute">{k}</span><span className="flex-1">{v}</span></div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-2">
        <Link to="/mypage/orders" className="btn btn-line btn-lg">주문 상세보기</Link>
        <Link to="/" className="btn btn-ink btn-lg">쇼핑 계속하기</Link>
      </div>
    </div>
  );
}
