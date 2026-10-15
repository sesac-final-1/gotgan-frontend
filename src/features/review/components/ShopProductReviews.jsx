// 상품 상세 · 리뷰 영역 — 담당 이경석
import { useState, useMemo } from 'react';
import { X, ThumbsUp, Camera } from 'lucide-react';
import { useReviewsQuery } from '@/features/review/hooks/useReviewsQuery';
import { ratingSummary } from '@/features/review/utils/ratingSummary';
import { Stars, Checkbox, Pager, GradeBadge } from '@/shared/components/ui';
import { cx, comma, ymd, maskName } from '@/shared/utils/format';

const RSORT = { recent: (a, b) => b.date - a.date, helpful: (a, b) => b.helpful - a.helpful, high: (a, b) => b.rating - a.rating, low: (a, b) => a.rating - b.rating };
// TODO(이경석): 리뷰 응답에 작성자 표시 정보(author: name · nick · avatar · grade) 필요 — 목업 리뷰엔 userId 만 있어 기본값 표시
const AUTHOR_FALLBACK = { name: '구매자', nick: '구매자', avatar: null, grade: 'NORMAL' };

export default function ShopProductReviews({ p, store }) {
  const { data: reviews = [] } = useReviewsQuery();
  const [photoOnly, setPhotoOnly] = useState(false);
  const [starFilter, setStarFilter] = useState(0);
  const [rsort, setRsort] = useState('recent');
  const [helped, setHelped] = useState(new Set());

  const revs = useMemo(() => reviews.filter((r) => r.productId === p.id && !r.blinded), [reviews, p.id]);
  const sum = useMemo(() => ratingSummary(revs), [revs]);
  const filtered = useMemo(
    () => revs.filter((r) => (!photoOnly || r.photos.length) && (!starFilter || r.rating === starFilter)).sort(RSORT[rsort]),
    [revs, photoOnly, starFilter, rsort],
  );
  const fits = p.cat === 'fashion' || p.cat === 'shoes-bags' ? ['작아요', '정사이즈', '커요'].map((f) => ({ f, n: revs.filter((r) => r.fit === f).length })) : null;
  const photos = revs.filter((r) => r.photos.length);

  return (
    <section id="reviews" className="scroll-mt-32 pt-16">
      <div className="flex items-baseline justify-between border-b border-ink pb-3">
        <h3 className="text-[20px] font-bold">리뷰 <span className="num">{comma(p.reviews)}</span></h3>
        <span className="text-[12px] text-mute">구매확정 후 작성된 리뷰만 노출됩니다</span>
      </div>
      <div className="grid sm:grid-cols-[200px_1fr_1fr] gap-8 py-8 border-b border-line">
        <div className="text-center sm:border-r border-line sm:pr-8">
          <div className="text-[46px] font-bold leading-none num">{p.rating.toFixed(1)}</div>
          <Stars value={p.rating} size={16} className="mt-2" />
          <div className="text-[12px] text-mute mt-2">상위 {p.rating >= 4.8 ? 3 : 12}% 만족도</div>
        </div>
        <ul className="space-y-1.5 text-[12.5px]">
          {sum.dist.map((d) => (
            <li key={d.star}>
              <button onClick={() => setStarFilter(starFilter === d.star ? 0 : d.star)} className={cx('w-full flex items-center gap-2.5', starFilter && starFilter !== d.star && 'opacity-40')}>
                <span className="w-6 text-left">{d.star}점</span>
                <span className="flex-1 h-1.5 bg-sand"><span className="block h-full bg-ink" style={{ width: `${(d.count / (sum.total || 1)) * 100}%` }} /></span>
                <span className="w-9 text-right num text-mute">{Math.round((d.count / (sum.total || 1)) * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
        {fits ? (
          <div className="text-[12.5px]">
            <div className="font-semibold mb-2">사이즈</div>
            {fits.map(({ f, n }) => {
              const tot = fits.reduce((a, x) => a + x.n, 0) || 1;
              const top = n === Math.max(...fits.map((x) => x.n));
              return (
                <div key={f} className="flex items-center gap-2.5 mb-1.5">
                  <span className={cx('w-12', top && 'font-bold')}>{f}</span>
                  <span className="flex-1 h-1.5 bg-sand"><span className={cx('block h-full', top ? 'bg-point' : 'bg-line-2')} style={{ width: `${(n / tot) * 100}%` }} /></span>
                  <span className="w-9 text-right num text-mute">{Math.round((n / tot) * 100)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[12.5px] space-y-2">
            <div className="font-semibold">구매자 한마디</div>
            <div className="flex flex-wrap gap-1.5">{['포장이 꼼꼼해요', '재구매 의사 있어요', '선물용 추천', '배송 빨라요'].map((k) => <span key={k} className="px-2 py-1 bg-cream">{k}</span>)}</div>
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="py-6 border-b border-line">
          <div className="text-[13px] font-semibold mb-3 flex items-center gap-1.5"><Camera size={15} strokeWidth={1.7} /> 포토 리뷰 <span className="num text-mute">{photos.length}</span></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {photos.map((r) => <img key={r.id} src={r.photos[0]} alt="" className="w-24 h-24 object-cover shrink-0" />)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-line text-[13px]">
        <div className="flex items-center gap-4">
          <Checkbox checked={photoOnly} onChange={setPhotoOnly} label="포토 리뷰만" />
          {starFilter > 0 && <button onClick={() => setStarFilter(0)} className="inline-flex items-center gap-1 h-7 px-2 bg-sand">{starFilter}점만<X size={12} /></button>}
        </div>
        <div className="flex gap-3">
          {[['recent', '최신순'], ['helpful', '도움순'], ['high', '평점 높은순'], ['low', '평점 낮은순']].map(([k, l]) => (
            <button key={k} onClick={() => setRsort(k)} className={rsort === k ? 'font-bold' : 'text-mute'}>{l}</button>
          ))}
        </div>
      </div>

      <ul>
        {filtered.map((r) => {
          const u = r.author ?? AUTHOR_FALLBACK;
          return (
            <li key={r.id} className="py-6 border-b border-line">
              <div className="flex items-center gap-2.5">
                {u.avatar ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-sand" />}
                <div>
                  <div className="text-[13px] font-semibold">{maskName(u.nick)} <GradeBadge grade={u.grade} className="ml-1 align-middle" /></div>
                  <div className="flex items-center gap-2 text-[11.5px] text-mute"><Stars value={r.rating} size={11} /> {ymd(r.date)}</div>
                </div>
              </div>
              <div className="mt-3 text-[12px] text-mute">{r.option && <>옵션: {r.option}</>}{r.fit && <> · 사이즈 <b className="text-ink-2">{r.fit}</b></>}</div>
              <p className="mt-2 text-[14px] font-semibold">{r.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{r.body}</p>
              {r.photos.length > 0 && <img src={r.photos[0]} alt="" className="mt-3 w-28 h-28 object-cover" />}
              {r.reply && (
                <div className="mt-4 bg-cream p-4 text-[13px]">
                  <div className="font-bold mb-1">{store.name} <span className="font-normal text-mute text-[11px] ml-1">판매자 답글</span></div>
                  <p className="text-ink-2 leading-relaxed">{r.reply}</p>
                </div>
              )}
              <div className="mt-4 flex items-center gap-4 text-[12px]">
                {/* TODO(이경석): useReviewHelpfulMutation */}
                <button onClick={() => setHelped((h) => { const n = new Set(h); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
                  className={cx('inline-flex items-center gap-1.5 h-7 px-2.5 border', helped.has(r.id) ? 'border-ink bg-ink text-white' : 'border-line-2 text-ink-2')}>
                  <ThumbsUp size={12} /> 도움돼요 <span className="num">{r.helpful + (helped.has(r.id) ? 1 : 0)}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <Pager total={5} className="mt-8" />
    </section>
  );
}
