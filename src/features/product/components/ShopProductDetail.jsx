// 상품 상세 — 담당 박지연 (리뷰 · Q&A 영역은 review 도메인 컴포넌트)
import { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router';
import { Share2, X, Minus, Plus, ChevronRight, Truck } from 'lucide-react';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import { useQnasQuery } from '@/features/review/hooks/useQnasQuery';
import { useCart } from '@/features/order/hooks/useCart';
import { earnOf } from '@/features/user/constants';
import ProductCard from '@/features/product/components/ProductCard';
import ShopProductReviews from '@/features/review/components/ShopProductReviews';
import ShopProductQna from '@/features/review/components/ShopProductQna';
import { Stars, Price, Modal } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { cx, comma, won, salePrice } from '@/shared/utils/format';

function Qty({ value, onChange }) {
  return (
    <div className="flex items-center border border-line-2 bg-white h-8">
      <button className="w-8 h-full flex items-center justify-center hover:bg-sand" onClick={() => onChange(value - 1)}><Minus size={13} /></button>
      <span className="w-9 text-center text-[13px] num">{value}</span>
      <button className="w-8 h-full flex items-center justify-center hover:bg-sand" onClick={() => onChange(value + 1)}><Plus size={13} /></button>
    </div>
  );
}

export default function ShopProductDetail() {
  const { id } = useParams();
  const { data: products = [], isLoading } = useProductsQuery();
  const { data: stores = [] } = useStoresQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const p = products.find((x) => x.id === id);
  const store = p && stores.find((s) => s.id === p.storeId);
  const cat = p && categories.find((c) => c.id === p.cat);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!p) return <div className="p-20 text-center">상품을 찾을 수 없습니다. <Link to="/" className="underline">홈으로</Link></div>;
  if (!store || !cat) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  // key: 다른 상품으로 이동하면 이미지 · 옵션 선택 · 리뷰 필터 상태 초기화
  return <DetailBody key={p.id} p={p} store={store} cat={cat} products={products} stores={stores} />;
}

function DetailBody({ p, store, cat, products, stores }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { addToCart } = useCart();
  const { data: qnas = [] } = useQnasQuery();
  const [img, setImg] = useState(0);
  const [pick, setPick] = useState({});
  const [lines, setLines] = useState([]);
  const [tab, setTab] = useState('info');
  const [cartModal, setCartModal] = useState(false);

  useEffect(() => { if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView(), 50); }, [loc.hash]);

  const storeById = useMemo(() => toMap(stores), [stores]);
  const myQna = useMemo(() => qnas.filter((q) => q.productId === p.id), [qnas, p.id]);
  const others = useMemo(
    () => products.filter((x) => x.storeId === p.storeId && x.id !== p.id && x.status !== '판매중지' && storeById[x.storeId]?.status === '운영중').slice(0, 4),
    [products, storeById, p.storeId, p.id],
  );
  const unit = salePrice(p);
  const soldOut = p.status === '품절';
  const total = lines.reduce((a, l) => a + l.qty * unit, 0);
  const ship = store.freeOver && total >= store.freeOver ? 0 : store.shipFee;

  const choose = (name, v) => {
    const next = { ...pick, [name]: v };
    if (p.options.every((o) => next[o.name])) {
      const label = p.options.map((o) => next[o.name]).join(' / ');
      if (!lines.find((l) => l.label === label)) setLines([...lines, { label, qty: 1 }]);
      setPick({});
    } else setPick(next);
  };
  const ensureLines = () => {
    if (p.options.length === 0) return lines.length ? lines : [{ label: '', qty: 1 }];
    if (!lines.length) { toast('옵션을 선택해주세요'); return null; }
    return lines;
  };
  // TODO(이경석): useAddCartItemMutation — 지금은 useCart 목업 스토어에 담기
  const onCart = () => { const ls = ensureLines(); if (!ls) return; ls.forEach((l) => addToCart(p.id, l.label, l.qty)); setCartModal(true); };
  const onBuy = () => { const ls = ensureLines(); if (!ls) return; ls.forEach((l) => addToCart(p.id, l.label, l.qty)); nav('/checkout'); };

  const TABS = [['info', '상품정보'], ['reviews', `리뷰 ${comma(p.reviews)}`], ['qna', `Q&A ${myQna.length}`], ['ship', '배송/교환/반품']];
  const go = (k) => { setTab(k); document.getElementById(k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-6">
      <div className="text-[12px] text-mute mb-5 flex items-center gap-1">
        <Link to="/" className="hover:text-ink">홈</Link><ChevronRight size={12} />
        <Link to={`/products?cat=${cat.id}`} className="hover:text-ink">{cat.name}</Link><ChevronRight size={12} />
        <Link to={`/products?cat=${cat.id}&sub=${p.sub}`} className="hover:text-ink">{p.sub}</Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_440px] gap-8 lg:gap-14">
        {/* 갤러리 */}
        <div className="flex flex-col-reverse md:flex-row gap-3">
          <div className="flex md:flex-col gap-2">
            {p.images.map((s, i) => (
              <button key={s} onMouseEnter={() => setImg(i)} onClick={() => setImg(i)} className={cx('w-16 h-20 border-2 shrink-0', i === img ? 'border-ink' : 'border-transparent')}>
                <img src={s} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <div className="relative flex-1 bg-sand aspect-[4/5] overflow-hidden">
            <img src={p.images[img]} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
            {soldOut && <span className="absolute left-4 top-4 bg-ink text-white text-xs font-bold px-3 py-1.5">일시품절 · 재입고 알림 신청 가능</span>}
          </div>
        </div>

        {/* 구매 정보 */}
        <div className="lg:sticky lg:top-24 self-start">
          <Link to={`/store/${store.id}`} className="inline-flex items-center gap-2 text-[13px] font-bold hover:underline">
            <span className="w-5 h-5 text-[10px] text-white flex items-center justify-center" style={{ background: store.color }}>{store.name[0]}</span>
            {store.name} <ChevronRight size={14} />
          </Link>
          <h1 className="mt-2 text-[22px] font-bold leading-snug tracking-tight">{p.name}</h1>
          <button onClick={() => go('reviews')} className="mt-2 flex items-center gap-2 text-[13px]">
            <Stars value={p.rating} size={13} /> <b>{p.rating.toFixed(1)}</b> <span className="text-mute underline">리뷰 {comma(p.reviews)}개</span>
          </button>
          <div className="mt-5 pb-5 border-b border-line"><Price p={p} size="lg" /></div>

          <dl className="py-4 border-b border-line text-[13px] grid grid-cols-[72px_1fr] gap-y-2.5">
            <dt className="text-mute">적립</dt><dd>결제 시 실결제금액의 5% · 약 <b className="num">{comma(earnOf(unit))}P</b></dd>
            <dt className="text-mute">배송</dt>
            <dd>
              <div className="flex items-center gap-1.5"><Truck size={14} strokeWidth={1.6} /> {store.courier} · {store.shipFee ? `${comma(store.shipFee)}원` : '무료배송'}</div>
              {store.freeOver > 0 && store.shipFee > 0 && <div className="text-mute mt-0.5">{comma(store.freeOver)}원 이상 구매 시 무료 (스토어 묶음배송)</div>}
              <div className="text-moss mt-0.5 font-medium">{store.dispatch}</div>
            </dd>
          </dl>

          {/* 옵션 */}
          {!soldOut && (
            <div className="pt-5 space-y-2.5">
              {p.options.map((o, oi) => (
                <select key={o.name} value={pick[o.name] || ''} disabled={oi > 0 && !pick[p.options[oi - 1].name]} onChange={(e) => choose(o.name, e.target.value)} className="field disabled:bg-cream disabled:text-mute">
                  <option value="">{o.name} 선택</option>
                  {o.values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ))}
              {lines.map((l) => (
                <div key={l.label} className="bg-cream p-3.5 flex items-center justify-between gap-3">
                  <div className="text-[13px] min-w-0">
                    <div className="truncate">{l.label}</div>
                    <div className="mt-2"><Qty value={l.qty} onChange={(q) => setLines(lines.map((x) => (x.label === l.label ? { ...x, qty: Math.max(1, q) } : x)))} /></div>
                  </div>
                  <div className="text-right">
                    <button onClick={() => setLines(lines.filter((x) => x.label !== l.label))} className="text-mute hover:text-ink"><X size={16} /></button>
                    <div className="mt-2 font-bold num text-sm">{won(unit * l.qty)}</div>
                  </div>
                </div>
              ))}
              {p.options.length === 0 && !lines.length && (
                <div className="bg-cream p-3.5 flex items-center justify-between text-[13px]">
                  <span>{p.name}</span><Qty value={1} onChange={(q) => setLines([{ label: '', qty: Math.max(1, q) }])} />
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex items-baseline justify-between">
            <span className="text-[13px] text-ink-2">총 상품금액 <span className="text-mute">(배송비 {ship ? won(ship) : '무료'})</span></span>
            <span className="text-[24px] font-bold num">{won(total)}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {soldOut ? (
              // TODO(박지연): useRestockAlertMutation
              <button onClick={() => toast('재입고 알림을 신청했어요')} className="btn btn-ink btn-lg col-span-2">재입고 알림 신청</button>
            ) : (
              <>
                <button onClick={onCart} className="btn btn-line btn-lg">장바구니</button>
                <button onClick={onBuy} className="btn btn-ink btn-lg">바로 구매</button>
              </>
            )}
          </div>
          <button onClick={() => toast('링크를 복사했어요')} className="mt-3 text-[12px] text-mute flex items-center gap-1 hover:text-ink"><Share2 size={13} /> 공유하기</button>
        </div>
      </div>

      {/* 탭 */}
      <div className="sticky top-16 z-30 bg-white border-b border-line mt-16 flex gap-8 overflow-x-auto no-scrollbar">
        {TABS.map(([k, l]) => <button key={k} onClick={() => go(k)} className={cx('tab shrink-0', tab === k && 'tab-on')}>{l}</button>)}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-12">
        <div className="min-w-0">
          {/* 상품정보 */}
          <section id="info" className="scroll-mt-32 pt-10">
            <div className="max-w-[720px] mx-auto">
              <p className="text-center eyebrow">Detail</p>
              <h3 className="text-center text-[22px] font-bold mt-2">{p.name}</h3>
              <p className="text-center text-sm text-ink-2 mt-3 leading-relaxed">{store.intro}</p>
              <div className="mt-8 space-y-2">
                {p.images.map((s) => <img key={s} src={s} alt="" className="w-full" />)}
              </div>
              <h4 className="mt-12 mb-3 font-bold text-[15px]">상품정보 제공고시</h4>
              <table className="w-full text-[13px] border-t border-ink">
                <tbody>
                  {[['소재', p.material], ['제조국', p.origin], ['제조자/수입자', store.name], ['품질보증기준', '관련 법 및 소비자분쟁해결 기준에 따름'], ['A/S 책임자', `${store.name} ${store.phone}`]].map(([k, v]) => (
                    <tr key={k} className="border-b border-line"><th className="w-36 bg-cream text-left font-medium px-3 py-2.5 text-ink-2">{k}</th><td className="px-3 py-2.5">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 리뷰 */}
          <ShopProductReviews p={p} store={store} />

          {/* Q&A */}
          <ShopProductQna list={myQna} />

          {/* 배송/교환/반품 */}
          <section id="ship" className="scroll-mt-32 pt-16">
            <h3 className="text-[20px] font-bold border-b border-ink pb-3">배송 / 교환 / 반품 안내</h3>
            <table className="w-full text-[13px] mt-0">
              <tbody>
                {[
                  ['배송 방법', `${store.courier} 택배`],
                  ['배송비', store.shipFee ? `${won(store.shipFee)} (${won(store.freeOver)} 이상 무료) · 제주/도서산간 3,000원 추가` : '무료배송'],
                  ['출고', store.dispatch],
                  ['교환/반품 신청', '배송 완료 후 7일 이내, 마이페이지 > 주문/배송에서 신청'],
                  ['반품 배송비', `단순 변심: 왕복 ${won((store.shipFee || 3000) * 2)} / 상품 하자·오배송: 판매자 부담`],
                  ['교환/반품 불가', '착용 흔적·세탁·택 제거 시, 신선식품 단순 변심, 주문 제작 상품'],
                  ['구매 확정', '배송 완료 7일 후 자동 구매확정 (확정 이후에는 교환/반품 불가)'],
                  ['포인트', '취소 · 반품 완료 시 그 상품분 사용 포인트는 환원, 적립 포인트는 회수'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-line"><th className="w-40 bg-cream text-left font-medium px-3 py-3 text-ink-2 align-top">{k}</th><td className="px-3 py-3 leading-relaxed">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* 우측 스토어 카드 */}
        <aside className="hidden lg:block pt-10">
          <div className="sticky top-32 border border-line">
            <img src={store.cover} alt="" className="w-full aspect-[16/9] object-cover" />
            <div className="p-5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 text-white text-sm font-bold flex items-center justify-center" style={{ background: store.color }}>{store.name[0]}</span>
                <div>
                  <div className="font-bold text-[15px]">{store.name}</div>
                  <div className="text-[11.5px] text-mute">{store.grade} 판매자 · 관심고객 {comma(store.followers)}</div>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] text-ink-2 leading-relaxed">{store.intro}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {/* TODO(박지연): useFollowStoreMutation */}
                <button onClick={() => toast(`${store.name} 알림받기 완료`)} className="btn btn-line btn-sm">+ 알림받기</button>
                <Link to={`/store/${store.id}`} className="btn btn-ink btn-sm">스토어 홈</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {others.length > 0 && (
        <section className="mt-20">
          <h3 className="text-[20px] font-bold mb-5">{store.name}의 다른 상품</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">{others.map((x) => <ProductCard key={x.id} p={x} store={store} showStore={false} />)}</div>
        </section>
      )}

      <Modal open={cartModal} onClose={() => setCartModal(false)} title="장바구니에 담았어요" width={400}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setCartModal(false)}>쇼핑 계속하기</button><Link to="/cart" className="btn btn-ink btn-sm">장바구니 보기</Link></>}>
        <div className="flex gap-3">
          <img src={p.images[0]} alt="" className="w-16 h-20 object-cover" />
          <div className="text-[13px]"><div className="font-semibold">{p.name}</div><div className="text-mute mt-1">{lines.map((l) => l.label).filter(Boolean).join(', ') || '단일 상품'}</div></div>
        </div>
      </Modal>
    </div>
  );
}
