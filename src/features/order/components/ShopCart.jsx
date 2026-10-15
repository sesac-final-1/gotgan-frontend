// 장바구니 — 담당 이경석 (목업 레이아웃 유지 · 표 아님)
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { X, Minus, Plus, ChevronRight } from 'lucide-react';
import { useCart } from '@/features/order/hooks/useCart';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import ShopOrderSummary, { groupByStore } from '@/features/order/components/ShopOrderSummary';
import { Checkbox, Empty } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { won } from '@/shared/utils/format';

export default function ShopCart() {
  const { cart, setQty, toggleLine, toggleAll, removeLines } = useCart();
  const { data: stores = [] } = useStoresQuery();
  const nav = useNavigate();
  const storeById = useMemo(() => toMap(stores), [stores]);
  const checked = useMemo(() => cart.filter((l) => l.checked), [cart]);
  const groups = useMemo(() => groupByStore(cart, storeById), [cart, storeById]);
  const checkedGroups = useMemo(() => groupByStore(checked, storeById), [checked, storeById]);
  const allOn = cart.length > 0 && checked.length === cart.length;

  // TODO(이경석): useRemoveCartItemsMutation (수량 · 선택 변경도 같은 방식 — useCart 내부에서 교체)
  const removeChecked = () => { removeLines(checked.map((l) => l.key)); toast('선택한 상품을 삭제했어요'); };

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-10">
      <div className="flex items-end justify-between border-b border-ink pb-4">
        <h1 className="text-[28px] font-bold tracking-tight">장바구니 <span className="num text-point">{cart.length}</span></h1>
        <ol className="hidden sm:flex text-[13px] text-mute gap-2 items-center"><li className="text-ink font-bold">01 장바구니</li><ChevronRight size={14} /><li>02 주문/결제</li><ChevronRight size={14} /><li>03 주문완료</li></ol>
      </div>
      {cart.length === 0 ? (
        <Empty title="장바구니가 비어 있어요" desc="마음에 드는 상품을 담아보세요." action={<Link to="/products" className="btn btn-ink">쇼핑하러 가기</Link>} />
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 pt-5">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <Checkbox checked={allOn} onChange={toggleAll} label={`전체선택 (${checked.length}/${cart.length})`} />
              <button onClick={removeChecked} className="text-[13px] text-mute hover:text-ink">선택삭제</button>
            </div>
            {groups.map((g) => (
              <div key={g.store.id} className="mt-6 border border-line">
                <div className="flex items-center justify-between px-4 h-12 bg-cream border-b border-line">
                  <Link to={`/store/${g.store.id}`} className="font-bold text-[14px] hover:underline">{g.store.name}</Link>
                  <span className="text-[12px] text-ink-2">
                    {g.ship === 0 ? '무료배송' : <>배송비 {won(g.ship)} · <span className="text-point">{won(g.store.freeOver - g.subtotal)} 더 담으면 무료배송</span></>}
                  </span>
                </div>
                {g.lines.map((l) => (
                  <div key={l.key} className="flex gap-4 p-4 border-b border-line last:border-0">
                    <Checkbox checked={l.checked} onChange={() => toggleLine(l.key)} />
                    <Link to={`/products/${l.productId}`}><img src={l.product.images[0]} alt="" className="w-20 h-24 object-cover" /></Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <Link to={`/products/${l.productId}`} className="text-[14px] font-medium hover:underline line-clamp-2">{l.product.name}</Link>
                        <button onClick={() => removeLines([l.key])} className="text-mute hover:text-ink shrink-0"><X size={18} /></button>
                      </div>
                      {l.option && <div className="text-[12.5px] text-mute mt-1">{l.option}</div>}
                      <div className="mt-3 flex items-end justify-between">
                        <div className="flex items-center border border-line-2 h-8">
                          <button className="w-8 h-full flex items-center justify-center hover:bg-sand" onClick={() => setQty(l.key, l.qty - 1)}><Minus size={13} /></button>
                          <span className="w-9 text-center text-[13px] num">{l.qty}</span>
                          <button className="w-8 h-full flex items-center justify-center hover:bg-sand" onClick={() => setQty(l.key, l.qty + 1)}><Plus size={13} /></button>
                        </div>
                        <div className="text-right">
                          {l.product.discount > 0 && <div className="text-[12px] text-mute line-through num">{won(l.product.price * l.qty)}</div>}
                          <div className="font-bold num">{won(l.unit * l.qty)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="lg:sticky lg:top-24 self-start">
            <ShopOrderSummary groups={checkedGroups} cta={() => (
              <button disabled={!checked.length} onClick={() => nav('/checkout')} className="btn btn-ink btn-lg w-full">{checked.length}개 상품 주문하기</button>
            )} />
          </div>
        </div>
      )}
    </div>
  );
}
