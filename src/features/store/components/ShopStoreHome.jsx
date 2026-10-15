// 스토어 홈 (판매자 개별 스토어, 스마트스토어의 '내 스토어' 개념) — 담당 박지연
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Bell, MessageSquare } from 'lucide-react';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useReviewsQuery } from '@/features/review/hooks/useReviewsQuery';
import { ratingSummary } from '@/features/review/utils/ratingSummary';
import ProductCard from '@/features/product/components/ProductCard';
import { Stars, Empty } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { cx, comma, ymd } from '@/shared/utils/format';

export default function ShopStoreHome() {
  const { id } = useParams();
  const { data: stores = [], isLoading } = useStoresQuery();
  const s = stores.find((x) => x.id === id);
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!s) return <Empty title="존재하지 않는 스토어입니다" />;
  if (s.status !== '운영중') {
    return <Empty title={`${s.name}은(는) 현재 휴면 상태입니다`} desc="판매자가 스토어 운영을 일시 중단했어요. 알림을 받으면 재오픈 시 알려드려요." action={<Link to="/stores" className="btn btn-line btn-sm">다른 스토어 보기</Link>} />;
  }
  return <StoreBody key={s.id} s={s} />; // key: 다른 스토어로 이동하면 알림 · 분류 탭 상태 초기화
}

function StoreBody({ s }) {
  const { data: products = [] } = useProductsQuery();
  const { data: categories = [] } = useCategoriesQuery();
  const { data: reviews = [] } = useReviewsQuery();
  const [follow, setFollow] = useState(false);
  const [sub, setSub] = useState('전체');

  const items = useMemo(() => products.filter((p) => p.storeId === s.id && p.status !== '판매중지'), [products, s.id]);
  const subs = ['전체', ...new Set(items.map((p) => p.sub))];
  const sum = useMemo(() => ratingSummary(reviews.filter((r) => r.storeId === s.id)), [reviews, s.id]);
  const shown = items.filter((p) => sub === '전체' || p.sub === sub);
  const catName = categories.find((c) => c.id === s.cat)?.name;

  // TODO(박지연): useFollowStoreMutation
  const onFollow = () => { setFollow(!follow); toast(follow ? '알림을 해제했어요' : '새 상품 소식을 알려드릴게요'); };

  return (
    <div>
      <div className="relative h-[220px] md:h-[300px] overflow-hidden">
        <img src={s.cover} alt="" className="w-full h-full object-cover" />
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
              <p className="mt-1.5 text-[14px] text-ink-2 max-w-xl leading-relaxed">{s.intro}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-mute">
                <span>{catName}</span>
                <span>관심고객 <b className="text-ink num">{comma(s.followers + (follow ? 1 : 0))}</b></span>
                <span className="flex items-center gap-1"><Stars value={sum.avg} size={11} /> <b className="text-ink">{sum.avg.toFixed(1)}</b></span>
                <span>{ymd(s.since)} 오픈</span>
              </div>
            </div>
          </div>
          <div className="flex md:flex-col gap-2 md:w-40">
            <button onClick={onFollow} className={cx('btn flex-1', follow ? 'btn-line' : 'btn-ink')}>
              <Bell size={15} /> {follow ? '알림받는 중' : '알림받기'}
            </button>
            <button onClick={() => toast('판매자 톡 연결 (목업)')} className="btn btn-line flex-1"><MessageSquare size={15} /> 문의하기</button>
          </div>
        </div>

        <div className="mt-8 flex gap-6 border-b border-line overflow-x-auto no-scrollbar">
          {subs.map((x) => <button key={x} onClick={() => setSub(x)} className={cx('tab shrink-0', sub === x && 'tab-on')}>{x}</button>)}
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
          {shown.map((p) => <ProductCard key={p.id} p={p} store={s} showStore={false} />)}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-px bg-line border border-line text-[13px]">
          {[
            ['배송', `${s.courier} · ${s.shipFee ? `${comma(s.shipFee)}원 (${comma(s.freeOver)}원 이상 무료)` : '무료배송'}`],
            ['출고', s.dispatch],
            ['판매자 정보', `${s.owner} · 사업자 ${s.bizNo} · ${s.phone}`],
          ].map(([k, v]) => <div key={k} className="bg-white p-5"><div className="eyebrow mb-1.5">{k}</div>{v}</div>)}
        </div>
      </div>
    </div>
  );
}
