// 상품 상세 — 담당 박지연 (리뷰 · Q&A 영역은 review 도메인 컴포넌트) · 실제 API 화면 연결 구지훈(10/30)
// 상품은 GET /api/products/{id}, 스토어(이름 · 배송비 · 소개)는 GET /api/stores/{storeId} — 스토어 정보를 못 받거나 운영 중이 아니면 기본 문구
import { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router';
import { Share2, X, Minus, Plus, ChevronRight, Truck } from 'lucide-react';
import { useProductQuery } from '@/features/product/hooks/useProductQuery';
import { useProductSearchQuery } from '@/features/product/hooks/useProductSearchQuery';
import { useRatedProducts } from '@/features/product/hooks/useRatedProducts';
import { useStoreQuery } from '@/features/store/hooks/useStoreQuery';
import { useProductInquiriesQuery } from '@/features/review/hooks/useInquiries';
import { useProductReviewSummaryQuery } from '@/features/review/hooks/useProductReviews';
import { useCart } from '@/features/order/hooks/useCart';
import { earnOf } from '@/features/user/constants';
import ProductCard from '@/features/product/components/ProductCard';
import ShopProductReviews from '@/features/review/components/ShopProductReviews';
import ShopProductQna from '@/features/review/components/ShopProductQna';
import { Stars, Price, Modal } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { cx, comma, won, salePrice } from '@/shared/utils/format';
import { safeHtml } from '@/shared/utils/safeHtml';
import OpenChatButton from '@/features/chat/components/OpenChatButton';

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
  const { data: p, isLoading, isError } = useProductQuery(id);
  // 목록 카드(GET /api/stores)에는 배송 정책이 없어 스토어 홈 응답을 쓴다
  const { data: store } = useStoreQuery(p?.storeId);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (isError || !p) return <div className="p-20 text-center">상품을 찾을 수 없습니다. <Link to="/" className="underline">홈으로</Link></div>;
  // key: 다른 상품으로 이동하면 이미지 · 옵션 선택 · 리뷰 필터 상태 초기화
  return <DetailBody key={p.id} p={p} store={store?.status === '운영중' ? store : undefined} />;
}

const STORE_FALLBACK = { name: '판매 스토어' };

function DetailBody({ p, store: storeInfo }) {
  const store = storeInfo ?? { ...STORE_FALLBACK, id: p.storeId };
  const nav = useNavigate();
  const loc = useLocation();
  const { addToCart } = useCart();
  const { data: qnaPage } = useProductInquiriesQuery(p.id); // Q&A 탭 숫자 — ShopProductQna 첫 페이지와 같은 쿼리
  const { data: summary } = useProductReviewSummaryQuery(p.id); // 별점 · 리뷰 수 — ShopProductReviews 와 같은 쿼리
  const rating = summary?.averageRating ?? 0;
  const reviewCount = summary?.reviewCount ?? 0;
  const { data: storePage } = useProductSearchQuery({ storeId: p.storeId, size: 5 });
  const [img, setImg] = useState(0);
  const [pick, setPick] = useState({});
  const [lines, setLines] = useState([]);
  const [tab, setTab] = useState('info');
  const [cartModal, setCartModal] = useState(false);

  useEffect(() => { if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView(), 50); }, [loc.hash]);

  const storeProducts = useMemo(() => (storePage?.content ?? []).filter((x) => x.id !== p.id).slice(0, 4), [storePage, p.id]);
  const others = useRatedProducts(storeProducts);
  const unit = salePrice(p);
  const soldOut = p.status === '품절';
  const canBuy = p.purchasable; // 판매중지 · 스토어 정지 등은 200 + purchasable=false (product.md 10절)
  const total = lines.reduce((a, l) => a + l.qty * (unit + l.extra), 0);
  const ship = !storeInfo ? 0 : store.freeOver && total >= store.freeOver ? 0 : store.shipFee;

  // 장바구니는 언제나 productOptionId 로 담는다 — 고른 값 조합과 같은 optionItems 의 id · 추가금
  const single = p.optionItems[0]; // 옵션 없는 상품은 값 없는 옵션 1개
  const singleLine = (qty) => ({ label: '', qty, productOptionId: single?.id, extra: single?.extraPrice ?? 0 });
  const choose = (name, v) => {
    const next = { ...pick, [name]: v };
    if (p.options.every((o) => next[o.name])) {
      const values = p.options.map((o) => next[o.name]);
      const item = p.optionItems.find((x) => x.values.every((v, i) => v === values[i]));
      if (!item || item.soldOut) toast('품절된 옵션이에요');
      else if (!lines.find((l) => l.productOptionId === item.id)) setLines([...lines, { label: values.join(' / '), qty: 1, productOptionId: item.id, extra: item.extraPrice }]);
      setPick({});
    } else setPick(next);
  };
  const ensureLines = () => {
    if (p.options.length === 0) return lines.length ? lines : [singleLine(1)];
    if (!lines.length) { toast('옵션을 선택해주세요'); return null; }
    return lines;
  };
  const add = (ls) => addToCart(ls.map((l) => ({ productOptionId: l.productOptionId, quantity: l.qty })));
  const onCart = async () => { const ls = ensureLines(); if (ls && await add(ls)) setCartModal(true); };
  const onBuy = async () => { const ls = ensureLines(); if (ls && await add(ls)) void nav('/checkout'); };

  const TABS = [['info', '상품정보'], ['reviews', `리뷰 ${comma(reviewCount)}`], ['qna', `Q&A ${comma(qnaPage?.totalElements ?? 0)}`], ['ship', '배송/교환/반품']];
  const go = (k) => { setTab(k); document.getElementById(k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-6">
      <div className="text-[12px] text-mute mb-5 flex items-center gap-1">
        <Link to="/" className="hover:text-ink">홈</Link><ChevronRight size={12} />
        <Link to={`/products?cat=${p.cat}`} className="hover:text-ink">{p.catName}</Link><ChevronRight size={12} />
        <Link to={`/products?cat=${p.cat}&sub=${p.catId}`} className="hover:text-ink">{p.sub}</Link>
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
            <span className="w-5 h-5 text-[10px] text-white flex items-center justify-center bg-ink" style={{ background: store.color }}>{store.name[0]}</span>
            {store.name} <ChevronRight size={14} />
          </Link>
          <OpenChatButton className="btn btn-line btn-xs ml-2" basePath="/mypage/chats"
            request={{ type: 'STORE_INQUIRY', storeId: p.storeId, context: { type: 'PRODUCT', id: p.id } }}>
            판매자에게 문의
          </OpenChatButton>
          <h1 className="mt-2 text-[22px] font-bold leading-snug tracking-tight">{p.name}</h1>
          <button onClick={() => go('reviews')} className="mt-2 flex items-center gap-2 text-[13px]">
            <Stars value={rating} size={13} /> <b>{rating.toFixed(1)}</b> <span className="text-mute underline">리뷰 {comma(reviewCount)}개</span>
          </button>
          <div className="mt-5 pb-5 border-b border-line"><Price p={p} size="lg" /></div>

          <dl className="py-4 border-b border-line text-[13px] grid grid-cols-[72px_1fr] gap-y-2.5">
            <dt className="text-mute">적립</dt><dd>구매확정 시 실결제금액의 5% · 약 <b className="num">{comma(earnOf(unit))}P</b></dd>
            <dt className="text-mute">배송</dt>
            {storeInfo ? (
              <dd>
                <div className="flex items-center gap-1.5"><Truck size={14} strokeWidth={1.6} /> {store.courier} · {store.shipFee ? `${comma(store.shipFee)}원` : '무료배송'}</div>
                {store.freeOver > 0 && store.shipFee > 0 && <div className="text-mute mt-0.5">{comma(store.freeOver)}원 이상 구매 시 무료 (스토어 묶음배송)</div>}
                <div className="text-moss mt-0.5 font-medium">{store.dispatch}</div>
              </dd>
            ) : (
              <dd className="flex items-center gap-1.5"><Truck size={14} strokeWidth={1.6} /> 스토어 배송 정책 — 장바구니에서 배송비 계산</dd>
            )}
          </dl>

          {/* 옵션 */}
          {!soldOut && canBuy && (
            <div className="pt-5 space-y-2.5">
              {p.options.map((o, oi) => (
                <select key={o.name} value={pick[o.name] || ''} disabled={oi > 0 && !pick[p.options[oi - 1].name]} onChange={(e) => choose(o.name, e.target.value)} className="field disabled:bg-cream disabled:text-mute">
                  <option value="">{o.name} 선택</option>
                  {o.values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ))}
              {lines.map((l) => (
                <div key={l.productOptionId} className="bg-cream p-3.5 flex items-center justify-between gap-3">
                  <div className="text-[13px] min-w-0">
                    <div className="truncate">{l.label}{l.extra > 0 && <span className="text-mute"> (+{comma(l.extra)}원)</span>}</div>
                    <div className="mt-2"><Qty value={l.qty} onChange={(q) => setLines(lines.map((x) => (x.productOptionId === l.productOptionId ? { ...x, qty: Math.max(1, q) } : x)))} /></div>
                  </div>
                  <div className="text-right">
                    <button onClick={() => setLines(lines.filter((x) => x.productOptionId !== l.productOptionId))} className="text-mute hover:text-ink"><X size={16} /></button>
                    <div className="mt-2 font-bold num text-sm">{won((unit + l.extra) * l.qty)}</div>
                  </div>
                </div>
              ))}
              {p.options.length === 0 && !lines.length && (
                <div className="bg-cream p-3.5 flex items-center justify-between text-[13px]">
                  <span>{p.name}</span><Qty value={1} onChange={(q) => setLines([singleLine(Math.max(1, q))])} />
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex items-baseline justify-between">
            <span className="text-[13px] text-ink-2">총 상품금액 <span className="text-mute">(배송비 {ship ? won(ship) : '무료'})</span></span>
            <span className="text-[24px] font-bold num">{won(total)}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {!canBuy ? (
              <button disabled className="btn btn-line btn-lg col-span-2">현재 구매할 수 없는 상품입니다</button>
            ) : soldOut ? (
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
              {store.intro && <div className="text-center text-sm text-ink-2 mt-3 leading-relaxed" dangerouslySetInnerHTML={safeHtml(store.intro)} />}
              <div className="mt-8 space-y-2">
                {p.images.map((s) => <img key={s} src={s} alt="" className="w-full" />)}
              </div>
              <h4 className="mt-12 mb-3 font-bold text-[15px]">상품정보 제공고시</h4>
              <table className="w-full text-[13px] border-t border-ink">
                <tbody>
                  {[['소재', p.material], ['제조국', p.origin], ['제조자/수입자', store.name], ['품질보증기준', '관련 법 및 소비자분쟁해결 기준에 따름'], ['A/S 책임자', `${store.name} ${store.phone ?? ''}`]].map(([k, v]) => (
                    <tr key={k} className="border-b border-line"><th className="w-36 bg-cream text-left font-medium px-3 py-2.5 text-ink-2">{k}</th><td className="px-3 py-2.5">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 리뷰 */}
          <ShopProductReviews p={p} store={store} />

          {/* Q&A */}
          <ShopProductQna p={p} />

          {/* 배송/교환/반품 */}
          <section id="ship" className="scroll-mt-32 pt-16">
            <h3 className="text-[20px] font-bold border-b border-ink pb-3">배송 / 교환 / 반품 안내</h3>
            <table className="w-full text-[13px] mt-0">
              <tbody>
                {[
                  ...(storeInfo ? [
                    ['배송 방법', `${store.courier} 택배`],
                    ['배송비', store.shipFee ? `${won(store.shipFee)} (${won(store.freeOver)} 이상 무료) · 제주/도서산간 3,000원 추가` : '무료배송'],
                    ['출고', store.dispatch],
                  ] : [['배송비', '스토어 배송 정책에 따름 — 장바구니에서 스토어별로 계산']]),
                  ['교환/반품 신청', '배송 완료 후 7일 이내, 마이페이지 > 주문/배송에서 신청'],
                  ['반품 배송비', `단순 변심: 왕복 ${storeInfo ? won((store.shipFee || 3000) * 2) : '배송비'} / 상품 하자·오배송: 판매자 부담`],
                  ['교환/반품 불가', '착용 흔적·세탁·택 제거 시, 신선식품 단순 변심, 주문 제작 상품'],
                  ['구매 확정', '배송 완료 7일 후 자동 구매확정 (확정 이후에는 교환/반품 불가)'],
                  ['포인트', '적립은 구매확정 때 · 취소 · 반품 완료 시 그 상품분 사용 포인트는 환원'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-line"><th className="w-40 bg-cream text-left font-medium px-3 py-3 text-ink-2 align-top">{k}</th><td className="px-3 py-3 leading-relaxed">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* 우측 스토어 카드 */}
        <aside className="hidden lg:block pt-10">
          {storeInfo && <div className="sticky top-32 border border-line">
            {store.cover ? <img src={store.cover} alt="" className="w-full aspect-[16/9] object-cover" /> : <div className="w-full aspect-[16/9]" style={{ background: store.color }} />}
            <div className="p-5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 text-white text-sm font-bold flex items-center justify-center" style={{ background: store.color }}>{store.name[0]}</span>
                <div>
                  <div className="font-bold text-[15px]">{store.name}</div>
                  <div className="text-[11.5px] text-mute">{store.grade} 판매자 · 관심고객 {comma(store.followers)}</div>
                </div>
              </div>
              <div className="mt-3 text-[12.5px] text-ink-2 leading-relaxed" dangerouslySetInnerHTML={safeHtml(store.intro)} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {/* TODO(박지연): useFollowStoreMutation */}
                <button onClick={() => toast(`${store.name} 알림받기 완료`)} className="btn btn-line btn-sm">+ 알림받기</button>
                <Link to={`/store/${store.id}`} className="btn btn-ink btn-sm">스토어 홈</Link>
              </div>
            </div>
          </div>}
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
