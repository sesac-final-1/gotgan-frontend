// 전체 스토어 목록 — 담당 박지연 (카드 그리드라 DataTable 아님)
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import { useProductSearchQuery } from '@/features/product/hooks/useProductSearchQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { ListStatus } from '@/features/product/components/ListStatus';
import { toMap } from '@/shared/utils/collection';
import { safeHtml } from '@/shared/utils/safeHtml';
import { cx } from '@/shared/utils/format';

const NO_STORES = [];

export default function ShopStoreList() {
  const storesQuery = useStoresQuery();
  const { data: stores = NO_STORES } = storesQuery;
  const { data: categories = [] } = useCategoriesQuery();
  const [cat, setCat] = useState('all');
  const catById = useMemo(() => toMap(categories), [categories]);
  const list = useMemo(() => stores.filter((s) => s.status === '운영중' && (cat === 'all' || s.cat === cat)), [stores, cat]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-10">
      <div className="eyebrow">Stores</div>
      <h1 className="mt-2 text-[28px] font-bold tracking-tight border-b border-ink pb-4">곳간의 가게들</h1>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-5">
        {[['all', '전체'], ...categories.map((c) => [c.id, c.name])].map(([k, l]) => (
          <button key={k} onClick={() => setCat(k)} className={cx('h-8 px-3.5 text-[13px] border shrink-0', cat === k ? 'bg-ink text-white border-ink' : 'border-line-2 hover:border-ink')}>{l}</button>
        ))}
      </div>
      {!storesQuery.data ? <ListStatus query={storesQuery} failText="가게 목록을 불러오지 못했어요." /> : list.length ? (
        <div className="grid md:grid-cols-2 gap-6">
          {list.map((s) => <StoreCard key={s.id} s={s} catName={catById[s.cat]?.name} />)}
        </div>
      ) : <p className="py-16 text-center text-sm text-mute">이 카테고리에는 아직 가게가 없어요.</p>}
    </div>
  );
}

// 스토어 카드 — 그 스토어 신상품 사진 3장은 카드마다 공개 목록(GET /api/products?storeId=&size=3)으로. 운영 중 스토어 수만큼 요청(데모 규모)
function StoreCard({ s, catName }) {
  const { data: page } = useProductSearchQuery({ storeId: s.id, sort: 'NEW', size: 3 });
  const items = (page?.content ?? []).filter((p) => p.images[0]);
  return (
    <Link to={`/store/${s.id}`} className="group border border-line hover:border-ink transition-colors">
      <div className="grid grid-cols-3 gap-px bg-line">
        {items.map((p) => <img key={p.id} src={p.images[0]} data-cat={p.cat} alt="" className="w-full aspect-square object-cover" />)}
      </div>
      <div className="p-5 flex items-start gap-4">
        <span className="w-11 h-11 shrink-0 text-white font-bold flex items-center justify-center" style={{ background: s.color }}>{s.name[0]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><b className="text-[16px] group-hover:underline">{s.name}</b><span className="text-[11px] text-mute">{catName}</span></div>
          {s.intro && <div className="text-[13px] text-ink-2 mt-1 line-clamp-1" dangerouslySetInnerHTML={safeHtml(s.intro)} />}
          <div className="text-[12px] text-mute mt-2">{s.grade}</div>
        </div>
      </div>
    </Link>
  );
}
