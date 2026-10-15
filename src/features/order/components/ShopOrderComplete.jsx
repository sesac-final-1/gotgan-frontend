// 주문 완료 — 담당 이경석. 결제 정보는 주문서에서 navigate state 로 받는다
import { Link, useLocation } from 'react-router';
import { Check } from 'lucide-react';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import { earnOf, POINT_RATE } from '@/features/user/constants';
import { won, comma } from '@/shared/utils/format';

export default function ShopOrderComplete() {
  const st = useLocation().state || {};
  const { data: myAddresses = [] } = useMyAddressesQuery();
  const addr = myAddresses[0];
  return (
    <div className="max-w-[640px] mx-auto px-4 pt-20 text-center">
      <div className="mx-auto w-14 h-14 bg-ink text-white flex items-center justify-center"><Check size={28} strokeWidth={2.5} /></div>
      <h1 className="mt-6 text-[26px] font-bold tracking-tight">주문이 완료되었습니다</h1>
      <p className="mt-2 text-sm text-ink-2">판매자가 주문을 확인하면 알림톡으로 알려드려요.</p>
      <div className="mt-10 border-t border-ink text-left text-[14px]">
        {[
          // TODO(이경석): 주문번호 · 배송지는 주문 생성 응답(useCreateOrderMutation)으로 교체
          ['주문번호', <span className="num">2026100110231187</span>],
          ['결제수단', st.method || '신용/체크카드'],
          ['사용 포인트', <span className="num">{comma(st.point || 0)}P</span>],
          ['실결제금액', <b className="num">{won(st.pay ?? 64400)}</b>],
          ['적립 포인트', <span className="num text-moss font-semibold">+{comma(st.earn ?? earnOf(st.pay ?? 64400))}P <span className="text-mute font-normal text-[12px]">실결제금액의 {POINT_RATE * 100}%</span></span>],
          ['배송지', addr ? `${addr.addr} ${addr.detail}` : ''],
        ].map(([k, v]) => (
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
