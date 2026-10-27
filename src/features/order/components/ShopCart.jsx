// 장바구니 — 담당 이경석 (GET /api/carts · 목업 레이아웃 유지 · 표 아님)
// 스토어별 묶음 · 배송비 · 무료배송까지 남은 금액은 서버 계산 (선택된 구매 가능 줄 기준). 수량 · 선택은 서버에 저장된다
import { Link, useNavigate } from 'react-router';
import { X, Minus, Plus, ChevronRight } from 'lucide-react';
import { useCart } from '@/features/order/hooks/useCart';
import ShopOrderSummary from '@/features/order/components/ShopOrderSummary';
import { MAX_QTY } from '@/features/order/utils/cartView';
import { Checkbox, Empty } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { cx, won } from '@/shared/utils/format';

export default function ShopCart() {
  const { cart, lines, isLoading, isError, setQty, toggleLine, toggleAll, removeLines } = useCart();
  const nav = useNavigate();
  const unavailable = cart?.unavailable ?? [];
  const checkedCount = cart?.checkedCount ?? 0;
  const orderable = lines.filter((l) => l.checked && l.purchasable).length;
  const allOn = lines.length > 0 && lines.every((l) => l.checked);

  const removeChecked = async () => {
    const ids = lines.filter((l) => l.checked).map((l) => l.productOptionId);
    if (!ids.length) { toast('삭제할 상품을 선택해 주세요'); return; }
    if (await removeLines(ids)) toast('선택한 상품을 삭제했어요');
  };

  if (isLoading) return <p className="text-mute py-20 text-center">장바구니를 불러오는 중…</p>;
  if (isError) return <Empty title="장바구니를 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />;
  const empty = lines.length === 0 && unavailable.length === 0;

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-10">
      <div className="flex items-end justify-between border-b border-ink pb-4">
        <h1 className="text-[28px] font-bold tracking-tight">장바구니 <span className="num text-point">{cart?.cartCount ?? 0}</span></h1>
        <ol className="hidden sm:flex text-[13px] text-mute gap-2 items-center"><li className="text-ink font-bold">01 장바구니</li><ChevronRight size={14} /><li>02 주문/결제</li><ChevronRight size={14} /><li>03 주문완료</li></ol>
      </div>
      {empty ? (
        <Empty title="장바구니가 비어 있어요" desc="마음에 드는 상품을 담아보세요." action={<Link to="/products" className="btn btn-ink">쇼핑하러 가기</Link>} />
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 pt-5">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <Checkbox checked={allOn} onChange={toggleAll} label={`전체선택 (${checkedCount}/${lines.length})`} />
              <button onClick={() => void removeChecked()} className="text-[13px] text-mute hover:text-ink">선택삭제</button>
            </div>
            {cart.stores.map((g) => (
              <div key={g.storeId} className="mt-6 border border-line">
                <div className="flex items-center justify-between px-4 h-12 bg-cream border-b border-line">
                  <Link to={`/store/${g.storeId}`} className="font-bold text-[14px] hover:underline">{g.storeName ?? '스토어'}</Link>
                  <span className="text-[12px] text-ink-2">
                    {g.productAmt === 0 ? '선택한 상품 없음'
                      : g.shippingFee === 0 ? '무료배송'
                        : <>배송비 {won(g.shippingFee)}{g.amountToFree > 0 && <> · <span className="text-point">{won(g.amountToFree)} 더 담으면 무료배송</span></>}</>}
                  </span>
                </div>
                {g.items.map((l) => (
                  <div key={l.productOptionId} className={cx('flex gap-4 p-4 border-b border-line last:border-0', !l.purchasable && 'opacity-60')}>
                    <Checkbox checked={l.checked} onChange={(on) => toggleLine(l.productOptionId, on)} />
                    <Link to={`/products/${l.productId}`}><img src={l.imageUrl} alt="" className="w-20 h-24 object-cover bg-cream" /></Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <Link to={`/products/${l.productId}`} className="text-[14px] font-medium hover:underline line-clamp-2">{l.productName}</Link>
                        <button onClick={() => void removeLines([l.productOptionId])} className="text-mute hover:text-ink shrink-0" aria-label="삭제"><X size={18} /></button>
                      </div>
                      {l.optionName && <div className="text-[12.5px] text-mute mt-1">{l.optionName}</div>}
                      {!l.purchasable && <div className="text-[12px] text-rust mt-1">지금은 구매할 수 없는 상품이에요 (주문에서 빠져요)</div>}
                      {l.purchasable && l.quantity > l.stock && <div className="text-[12px] text-rust mt-1">재고가 {l.stock}개 남았어요</div>}
                      <div className="mt-3 flex items-end justify-between">
                        <div className="flex items-center border border-line-2 h-8">
                          <button disabled={l.quantity <= 1} aria-label="수량 줄이기" className="w-8 h-full flex items-center justify-center hover:bg-sand disabled:opacity-30" onClick={() => setQty(l.productOptionId, l.quantity - 1)}><Minus size={13} /></button>
                          <span className="w-9 text-center text-[13px] num">{l.quantity}</span>
                          <button disabled={l.quantity >= MAX_QTY} aria-label="수량 늘리기" className="w-8 h-full flex items-center justify-center hover:bg-sand disabled:opacity-30" onClick={() => setQty(l.productOptionId, l.quantity + 1)}><Plus size={13} /></button>
                        </div>
                        <div className="font-bold num">{won(l.lineAmt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {unavailable.length > 0 && (
              <div className="mt-6 border border-line">
                <div className="px-4 h-12 flex items-center justify-between bg-cream border-b border-line text-[13px]">
                  <b>판매가 끝난 상품 {unavailable.length}개</b>
                  <button onClick={() => void removeLines(unavailable.map((u) => u.productOptionId))} className="text-mute hover:text-ink">모두 삭제</button>
                </div>
                <p className="p-4 text-[12.5px] text-mute">상품 정보를 찾을 수 없어 주문할 수 없어요.</p>
              </div>
            )}
          </div>
          <div className="lg:sticky lg:top-24 self-start">
            <ShopOrderSummary productAmt={cart.totalProductAmt} shippingFee={cart.totalShippingFee} cta={() => (
              <button disabled={!orderable} onClick={() => nav('/checkout')} className="btn btn-ink btn-lg w-full">{orderable}개 상품 주문하기</button>
            )} />
          </div>
        </div>
      )}
    </div>
  );
}
