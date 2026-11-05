// 스토어 홈 (판매자 개별 스토어, 스마트스토어의 '내 스토어' 개념) — 담당 박지연
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { MessageSquare } from 'lucide-react';
import { useStoreQuery } from '@/features/store/hooks/useStoreQuery';
import { useStoreRatingQuery } from '@/features/store/hooks/useStoreRatingQuery';
import { useProductSearchQuery } from '@/features/product/hooks/useProductSearchQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useRatedProducts } from '@/features/product/hooks/useRatedProducts';
import ProductCard from '@/features/product/components/ProductCard';
import { Stars, Empty } from '@/shared/components/ui';
import OpenChatButton from '@/features/chat/components/OpenChatButton';
import { safeHtml } from '@/shared/utils/safeHtml';
import { shippingText } from '@/features/store/storeText';
import { cx, comma, ymd } from '@/shared/utils/format';

const EMPTY = [];

// /store/:id — 스토어 한 건을 id 또는 스토어 주소 slug 로 조회(store.md 14-2 · 14-3). 주소의 값은 문자열이라 목록에서 숫자 id 와 비교하지 않는다
export default function ShopStoreHome() {
  const { id } = useParams();
  const { data: s, isLoading, isError, error } = useStoreQuery(id);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (isError && error?.response?.status !== 404) return <Empty title="스토어를 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />;
  if (!s) return <Empty title="존재하지 않는 스토어입니다" />;
  if (s.status !== '운영중') {
    return <Empty title={`${s.name}은(는) 현재 운영하지 않는 스토어입니다`} desc="운영이 정지되었거나 폐점한 스토어예요." action={<Link to="/stores" className="btn btn-line btn-sm">다른 스토어 보기</Link>} />;
  }
  return <StoreBody key={s.id} s={s} />; // key: 다른 스토어로 이동하면 분류 탭 상태 초기화
}

function StoreBody({ s }) {
  // 이 스토어의 쇼핑몰 노출 상품(신상품순, 데모 규모라 한 번에 100개) + 상품 별점은 review 평점 API
  const { data: page } = useProductSearchQuery({ storeId: s.id, sort: 'NEW', size: 100 });
  const items = useRatedProducts(page?.content ?? EMPTY);
  const { data: categories = [] } = useCategoriesQuery();
  const { data: rating = { avg: 0, count: 0 } } = useStoreRatingQuery(s.id);
  const [sub, setSub] = useState('전체');

  // 카드에는 하위 카테고리 id 만 있어 이름은 카테고리 트리로
  const subName = useMemo(() => Object.fromEntries(categories.flatMap((c) => c.children.map((x) => [x.id, x.name]))), [categories]);
  const subs = ['전체', ...new Set(items.map((p) => subName[p.catId]).filter(Boolean))];
  const shown = items.filter((p) => sub === '전체' || subName[p.catId] === sub);
  const catName = categories.find((c) => c.id === s.cat)?.name;

  return (
    <div>
      <div className="relative h-[220px] md:h-[300px] overflow-hidden">
        {s.cover ? <img src={s.cover} data-fallback="store" alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: s.color }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6">
        <div className="relative -mt-12 bg-white border border-line p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6">
          <div className="flex gap-5">
            <span className="w-20 h-20 shrink-0 text-white text-3xl font-black flex items-center justify-center" style={{ background: s.color }}>{s.name[0]}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[26px] font-bold tracking-tight">{s.name}</h1>
                <span className="text-[11px] font-bold px-1.5 py-0.5 border border-ink">{s.grade}</span>
              </div>
              {s.intro && <div className="mt-1.5 text-[14px] text-ink-2 max-w-xl leading-relaxed" dangerouslySetInnerHTML={safeHtml(s.intro)} />}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-mute">
                <span>{catName}</span>
                <span className="flex items-center gap-1"><Stars value={rating.avg} size={11} /> <b className="text-ink">{rating.avg.toFixed(1)}</b> <span className="num">({comma(rating.count)})</span></span>
                {s.since && <span>{ymd(s.since)} 오픈</span>}
              </div>
            </div>
          </div>
          <div className="flex md:flex-col gap-2 md:w-40">
            <OpenChatButton className="btn btn-line flex-1" basePath="/mypage/chats"
              request={{ type: 'STORE_INQUIRY', storeId: s.id, context: { type: 'STORE', id: s.id } }}>
              <MessageSquare size={15} /> 문의하기
            </OpenChatButton>
          </div>
        </div>

        <div className="mt-8 flex gap-6 border-b border-line overflow-x-auto no-scrollbar">
          {subs.map((x) => <button key={x} onClick={() => setSub(x)} className={cx('tab shrink-0', sub === x && 'tab-on')}>{x}</button>)}
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
          {shown.map((p) => <ProductCard key={p.id} p={p} store={s} showStore={false} />)}
        </div>
        {page && items.length === 0 && <p className="text-mute text-center py-10">아직 등록된 상품이 없어요</p>}

        <div className="mt-16 grid md:grid-cols-3 gap-px bg-line border border-line text-[13px]">
          {[
            ['배송', shippingText(s)],
            ['출고', s.dispatch || '-'],
            ['판매자 정보', [s.owner, s.bizNo && `사업자 ${s.bizNo}`, s.phone].filter(Boolean).join(' · ')],
          ].map(([k, v]) => <div key={k} className="bg-white p-5"><div className="eyebrow mb-1.5">{k}</div>{v}</div>)}
        </div>
      </div>
    </div>
  );
}
