// 상품 목록 · 검색 — 담당 박지연
// 서버 페이징 · 정렬 · 필터 — GET /api/products (product.md 9절). 정렬은 신상품 · 가격 2종만(판매량 · 리뷰 · 평점 정렬은 범위 밖)
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SlidersHorizontal, X } from 'lucide-react';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useProductSearchQuery } from '@/features/product/hooks/useProductSearchQuery';
import { useRatedProducts } from '@/features/product/hooks/useRatedProducts';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import ProductCard from '@/features/product/components/ProductCard';
import { Checkbox, Empty } from '@/shared/components/ui';
import { BlockPager } from '@/shared/components/common/BlockPager';
import { toMap } from '@/shared/utils/collection';
import { cx } from '@/shared/utils/format';

const SORTS = [
  ['new', '신상품순', 'NEW'],
  ['low', '낮은 가격순', 'PRICE_ASC'],
  ['high', '높은 가격순', 'PRICE_DESC'],
];
const SORT_API = Object.fromEntries(SORTS.map(([k, , api]) => [k, api]));
const PAGE_SIZE = 24;
const EMPTY = [];
// 판매가 [이상, 미만) — 서버 maxPrice 는 미포함, 마지막 구간은 상한 없음
const PRICES = [[0, 30000, '3만원 이하'], [30000, 80000, '3만 ~ 8만원'], [80000, 150000, '8만 ~ 15만원'], [150000, undefined, '15만원 이상']];

export default function ShopProductList() {
  const { data: categories = [] } = useCategoriesQuery();
  const { data: stores = [] } = useStoresQuery();
  const [sp, setSp] = useSearchParams();
  // cat · sub 는 상위 · 하위 카테고리 id(숫자 문자열). 상위 id 로 조회하면 서버가 하위를 모두 포함한다
  const cat = sp.get('cat'), sub = sp.get('sub'), q = sp.get('q') || '';
  const sort = SORT_API[sp.get('sort')] ? sp.get('sort') : 'new';
  const page = Math.max(0, Number(sp.get('page')) || 0);
  const [price, setPrice] = useState(null);
  const [excludeSoldOut, setExcludeSoldOut] = useState(false);
  const [mobileFilter, setMobileFilter] = useState(false);

  const { data } = useProductSearchQuery({
    categoryId: sub || cat || undefined, q: q || undefined, sort: SORT_API[sort],
    minPrice: price?.[0] || undefined, maxPrice: price?.[1], excludeSoldOut: excludeSoldOut || undefined,
    page, size: PAGE_SIZE,
  });
  const list = useRatedProducts(data?.content ?? EMPTY);
  const total = data?.totalElements ?? 0;

  const storeById = useMemo(() => toMap(stores), [stores]);
  const catById = useMemo(() => toMap(categories), [categories]);
  // 조건이 바뀌면 첫 페이지로
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k === 'cat') n.delete('sub'); if (k !== 'page') n.delete('page'); setSp(n); };
  const resetPage = () => set('page', null);

  const c = cat && catById[cat];
  const subName = c && sub ? c.children.find((x) => String(x.id) === sub)?.name : null;
  const title = q ? `‘${q}’ 검색 결과` : c ? c.name : '전체 상품';

  const Filters = (
    <div className="space-y-8 text-sm">
      <div>
        <div className="font-bold mb-3">카테고리</div>
        <ul className="space-y-1.5">
          <li><button onClick={() => set('cat', null)} className={cx(!cat ? 'font-bold' : 'text-ink-2 hover:text-ink')}>전체</button></li>
          {categories.map((x) => (
            <li key={x.id}>
              <button onClick={() => set('cat', x.id)} className={cx(cat === String(x.id) ? 'font-bold' : 'text-ink-2 hover:text-ink')}>{x.name}</button>
              {cat === String(x.id) && (
                <ul className="mt-1.5 ml-3 pl-3 border-l border-line space-y-1">
                  {x.children.map((s) => <li key={s.id}><button onClick={() => set('sub', sub === String(s.id) ? null : s.id)} className={cx('text-[13px]', sub === String(s.id) ? 'font-bold' : 'text-mute hover:text-ink')}>{s.name}</button></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="font-bold mb-3">가격</div>
        <div className="space-y-2">
          {PRICES.map((pr) => <Checkbox key={pr[2]} checked={price === pr} onChange={() => { setPrice(price === pr ? null : pr); resetPage(); }} label={pr[2]} />)}
        </div>
      </div>
      <Checkbox checked={excludeSoldOut} onChange={(v) => { setExcludeSoldOut(v); resetPage(); }} label="품절 상품 제외" />
    </div>
  );

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-8">
      <div className="text-[12px] text-mute mb-2"><Link to="/" className="hover:text-ink">홈</Link> / {c ? <>{c.name}{subName && ` / ${subName}`}</> : title}</div>
      <div className="flex items-end justify-between border-b border-ink pb-4">
        <h1 className="text-[28px] font-bold tracking-tight">{title}{c && <span className="ml-2 text-sm font-mono text-mute font-normal">{c.en}</span>}</h1>
        <button className="lg:hidden btn btn-line btn-sm" onClick={() => setMobileFilter(true)}><SlidersHorizontal size={14} /> 필터</button>
      </div>

      {c && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-4 border-b border-line">
          <button onClick={() => set('sub', null)} className={cx('h-8 px-3.5 text-[13px] border shrink-0', !sub ? 'bg-ink text-white border-ink' : 'border-line-2')}>전체</button>
          {c.children.map((s) => <button key={s.id} onClick={() => set('sub', s.id)} className={cx('h-8 px-3.5 text-[13px] border shrink-0', sub === String(s.id) ? 'bg-ink text-white border-ink' : 'border-line-2 hover:border-ink')}>{s.name}</button>)}
        </div>
      )}

      <div className="flex gap-10 pt-6">
        <aside className="hidden lg:block w-[190px] shrink-0">{Filters}</aside>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="text-[13px] text-ink-2">총 <b className="num text-ink">{total}</b>개
              {price && (
                <span className="ml-3 inline-flex flex-wrap gap-1.5 align-middle">
                  <button onClick={() => { setPrice(null); resetPage(); }} className="inline-flex items-center gap-1 h-6 px-2 bg-sand text-[12px]">{price[2]}<X size={12} /></button>
                </span>
              )}
            </div>
            <div className="flex gap-3 text-[13px]">
              {SORTS.map(([k, l]) => (
                <button key={k} onClick={() => set('sort', k)} className={cx(sort === k ? 'font-bold text-ink' : 'text-mute hover:text-ink', 'hidden sm:inline')}>{l}</button>
              ))}
              <select value={sort} onChange={(e) => set('sort', e.target.value)} className="sm:hidden field field-sm w-auto">
                {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          {list.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10">
              {list.map((p) => <ProductCard key={p.id} p={p} store={storeById[p.storeId]} />)}
            </div>
          ) : (
            <Empty title="조건에 맞는 상품이 없어요" desc="필터를 줄이거나 다른 검색어를 입력해보세요." action={<Link to="/products" className="btn btn-line btn-sm">전체 상품 보기</Link>} />
          )}
          <BlockPager pageIndex={page} pageCount={data?.totalPages ?? 0} onPage={(n) => set('page', n || null)} className="mt-14" />
        </div>
      </div>

      {mobileFilter && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMobileFilter(false)}>
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-[340px] bg-white p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6"><b>필터</b><button onClick={() => setMobileFilter(false)}><X size={20} /></button></div>
            {Filters}
            <button className="btn btn-ink w-full mt-8" onClick={() => setMobileFilter(false)}>{total}개 상품 보기</button>
          </div>
        </div>
      )}
    </div>
  );
}
