// 주문서 · 결제 — 담당 이경석 (목업 레이아웃 유지 · 표 아님)
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useCart } from '@/features/order/hooks/useCart';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import { useMyPointsQuery } from '@/features/user/hooks/useMyPointsQuery';
import { POINT_RATE } from '@/features/user/constants';
import ShopOrderSummary, { groupByStore, totalsOf } from '@/features/order/components/ShopOrderSummary';
import { Checkbox, Empty, Modal } from '@/shared/components/ui';
import { toMap } from '@/shared/utils/collection';
import { cx, won, comma } from '@/shared/utils/format';

const PAY_METHODS = ['신용/체크카드', '곳간페이', '카카오페이', '네이버페이', '토스페이', '무통장입금'];

function Section({ n, title, children, right }) {
  return (
    <section className="border-t border-ink pt-5 pb-8">
      <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-[17px]"><span className="num text-point mr-2 text-sm">{n}</span>{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export default function ShopCheckout() {
  const { cart, clearChecked } = useCart();
  const { data: stores = [] } = useStoresQuery();
  const { data: myAddresses = [] } = useMyAddressesQuery();
  const { data: points } = useMyPointsQuery();
  const myPointBalance = points?.balance ?? 0;
  const nav = useNavigate();
  const storeById = useMemo(() => toMap(stores), [stores]);
  const lines = useMemo(() => cart.filter((l) => l.checked), [cart]);
  const groups = useMemo(() => groupByStore(lines, storeById), [lines, storeById]);
  const [addrId, setAddrId] = useState(null);
  const addr = myAddresses.find((a) => a.id === addrId) ?? myAddresses[0];
  const [addrModal, setAddrModal] = useState(false);
  const [point, setPoint] = useState(0);
  const [method, setMethod] = useState(PAY_METHODS[0]);
  const [agree, setAgree] = useState(false);
  const base = totalsOf(groups);
  const maxUse = Math.min(myPointBalance, base.sale + base.ship);
  const applyPoint = (v) => setPoint(Math.max(0, Math.min(maxUse, v)));
  const t = totalsOf(groups, point);

  // TODO(이경석): useCreateOrderMutation + PortOne 결제 — 지금은 장바구니 선택분 비우고 완료 화면으로
  const pay = (amount, earn) => { clearChecked(); nav('/order/complete', { state: { pay: amount, method, point, earn } }); };

  if (!lines.length) return <Empty title="주문할 상품이 없어요" action={<Link to="/cart" className="btn btn-ink">장바구니로</Link>} />;

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-10">
      <div className="flex items-end justify-between border-b border-line pb-4 mb-6">
        <h1 className="text-[28px] font-bold tracking-tight">주문/결제</h1>
        <ol className="hidden sm:flex text-[13px] text-mute gap-2 items-center"><li>01 장바구니</li><ChevronRight size={14} /><li className="text-ink font-bold">02 주문/결제</li><ChevronRight size={14} /><li>03 주문완료</li></ol>
      </div>
      <div className="grid lg:grid-cols-[1fr_360px] gap-10">
        <div>
          <Section n="01" title="배송지" right={<button onClick={() => setAddrModal(true)} className="btn btn-line btn-xs">변경</button>}>
            {addr && (
              <div className="text-[14px] leading-relaxed">
                <div className="font-bold">{addr.name} <span className="ml-1 text-[11px] font-semibold border border-line-2 px-1.5 py-0.5">{addr.label}</span>{addr.main && <span className="ml-1 text-[11px] text-point font-semibold">기본배송지</span>}</div>
                <div className="text-ink-2">{addr.phone}</div>
                <div className="text-ink-2">({addr.zip}) {addr.addr} {addr.detail}</div>
              </div>
            )}
            <select className="field mt-4"><option>배송 요청사항을 선택해주세요</option><option>문 앞에 놓아주세요</option><option>경비실에 맡겨주세요</option><option>배송 전 연락 바랍니다</option><option>직접 입력</option></select>
          </Section>

          <Section n="02" title={`주문상품 ${lines.length}개`}>
            {groups.map((g) => (
              <div key={g.store.id} className="mb-4 border border-line">
                <div className="px-4 h-10 flex items-center justify-between bg-cream text-[13px]"><b>{g.store.name}</b><span className="text-ink-2">배송비 {g.ship ? won(g.ship) : '무료'}</span></div>
                {g.lines.map((l) => (
                  <div key={l.key} className="flex gap-3 p-3 border-t border-line text-[13px]">
                    <img src={l.product.images[0]} alt="" className="w-14 h-16 object-cover" />
                    <div className="flex-1"><div className="font-medium">{l.product.name}</div><div className="text-mute">{l.option || '단일상품'} · {l.qty}개</div></div>
                    <div className="font-bold num">{won(l.unit * l.qty)}</div>
                  </div>
                ))}
              </div>
            ))}
          </Section>

          <Section n="03" title="포인트 사용" right={<Link to="/mypage/points" className="text-[12px] text-mute hover:text-ink underline">내역 보기</Link>}>
            <div className="grid sm:grid-cols-[100px_1fr] gap-3 items-center text-[14px]">
              <span className="text-ink-2">보유 포인트</span>
              <span className="num font-bold">{comma(myPointBalance)}P</span>
              <span className="text-ink-2">사용</span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input value={point ? comma(point) : ''} onChange={(e) => applyPoint(Number(e.target.value.replace(/\D/g, '')) || 0)} className="field num pr-8 text-right" placeholder="0" inputMode="numeric" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-mute">P</span>
                </div>
                <button onClick={() => applyPoint(maxUse)} className="btn btn-line shrink-0">전액 사용</button>
                {point > 0 && <button onClick={() => setPoint(0)} className="btn btn-ghost shrink-0">취소</button>}
              </div>
              <span />
              <span className="text-[12px] text-mute -mt-1">1P = 1원 · 사용 후 잔여 {comma(myPointBalance - point)}P</span>
            </div>
            <div className="mt-4 bg-cream p-4 text-[13px] space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-2">상품금액 + 배송비</span><span className="num">{won(base.sale + base.ship)}</span></div>
              <div className="flex justify-between"><span className="text-ink-2">사용 포인트</span><span className="num">−{comma(point)}P</span></div>
              <div className="flex justify-between font-bold border-t border-line-2 pt-1.5"><span>실결제금액</span><span className="num">{won(t.pay)}</span></div>
              <div className="text-[12px] text-moss">결제 시 실결제금액의 {POINT_RATE * 100}% <b className="num">{comma(t.earn)}P</b> 적립 예정</div>
            </div>
          </Section>

          <Section n="04" title="결제수단">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAY_METHODS.map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={cx('h-12 border text-[14px]', method === m ? 'border-ink border-2 font-bold' : 'border-line-2 hover:border-ink')}>{m}</button>
              ))}
            </div>
            {method === '신용/체크카드' && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <select className="field"><option>카드사 선택</option><option>현대카드</option><option>신한카드</option><option>삼성카드</option><option>KB국민카드</option></select>
                <select className="field"><option>일시불</option><option>2개월 무이자</option><option>3개월 무이자</option></select>
              </div>
            )}
            {method === '무통장입금' && <p className="mt-3 text-[13px] text-ink-2 bg-cream p-3">주문 후 24시간 이내 미입금 시 자동 취소됩니다. 가상계좌가 발급됩니다.</p>}
          </Section>

          <section className="border-t border-ink pt-5 text-[13px] space-y-2">
            <Checkbox checked={agree} onChange={setAgree} label="주문 내용을 확인했으며, 아래 내용에 모두 동의합니다." />
            <ul className="pl-7 text-mute space-y-1 text-[12px]">
              <li>(필수) 개인정보 수집·이용 및 판매자 제3자 제공 동의</li>
              <li>(필수) 전자결제대행 이용 동의</li>
              <li>곳간은 통신판매중개자이며, 상품·거래 책임은 각 판매자에게 있습니다.</li>
            </ul>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 self-start">
          <ShopOrderSummary groups={groups} point={point} label="실결제금액" cta={(amount, earn) => (
            <button disabled={!agree} onClick={() => pay(amount, earn)} className="btn btn-point btn-lg w-full">{won(amount)} 결제하기</button>
          )} />
          {!agree && <p className="text-[12px] text-mute mt-2 text-center">약관에 동의해야 결제할 수 있어요</p>}
        </div>
      </div>

      <Modal open={addrModal} onClose={() => setAddrModal(false)} title="배송지 선택">
        <div className="space-y-2">
          {myAddresses.map((a) => (
            <button key={a.id} onClick={() => { setAddrId(a.id); setAddrModal(false); }} className={cx('w-full text-left border p-4 text-[13px]', addr?.id === a.id ? 'border-ink border-2' : 'border-line-2')}>
              <div className="font-bold">{a.label} · {a.name}{a.main && <span className="ml-2 text-point text-[11px]">기본</span>}</div>
              <div className="text-ink-2 mt-1">{a.addr} {a.detail}</div>
            </button>
          ))}
          <Link to="/mypage/addresses" className="btn btn-line w-full">+ 새 배송지 추가</Link>
        </div>
      </Modal>
    </div>
  );
}
