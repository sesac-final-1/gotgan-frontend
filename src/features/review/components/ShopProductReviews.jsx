// 상품 상세 · 리뷰 영역 — 담당 이경석
import { useState } from 'react';
import { X, Camera } from 'lucide-react';
import { useProductReviewSummaryQuery, useProductReviewsQuery } from '@/features/review/hooks/useProductReviews';
import { FIT_LABELS } from '@/features/review/constants';
import { Stars, Checkbox } from '@/shared/components/ui';
import { BlockPager } from '@/shared/components/common/BlockPager';
import { cx, comma, ymd } from '@/shared/utils/format';
import { useAuthStore } from '@/features/auth/stores/authStore';
import ReportModal from '@/features/report/components/ReportModal';

const PAGE_SIZE = 10;
const SORTS = [['LATEST', '최신순'], ['RATING_HIGH', '평점 높은순'], ['RATING_LOW', '평점 낮은순']];

export default function ShopProductReviews({ p, store }) {
  const [photoOnly, setPhotoOnly] = useState(false);
  const [starFilter, setStarFilter] = useState(0);
  const [sort, setSort] = useState('LATEST');
  const [page, setPage] = useState(0);

  const { data: summary } = useProductReviewSummaryQuery(p.id);
  const { data, isLoading, isError } = useProductReviewsQuery({
    productId: p.id, rating: starFilter || undefined, photoOnly, sort, page, size: PAGE_SIZE,
  });
  // 포토 리뷰 줄 — 사진 있는 최신 리뷰 한 페이지와 전체 수
  const { data: photoPage } = useProductReviewsQuery({ productId: p.id, photoOnly: true, sort: 'LATEST', page: 0, size: PAGE_SIZE });
  const list = data?.content ?? [];
  const photos = photoPage?.content ?? [];
  const avg = summary?.averageRating ?? 0;
  const total = summary?.reviewCount ?? 0;
  const fits = p.cat === 'fashion' || p.cat === 'shoes-bags' ? summary?.fits ?? [] : null;

  const canReport = useAuthStore((s) => !!s.user?.roles?.includes('BUYER')); // 리뷰 신고는 구매자(REV-12) — 판매자는 판매자센터의 '관리자 검토 요청'
  const [reportTarget, setReportTarget] = useState(null);

  // 필터 · 정렬이 바뀌면 1페이지로
  const changeStar = (star) => { setStarFilter(star); setPage(0); };
  const changePhotoOnly = (v) => { setPhotoOnly(v); setPage(0); };
  const changeSort = (s) => { setSort(s); setPage(0); };

  return (
    <section id="reviews" className="scroll-mt-32 pt-16">
      <div className="flex items-baseline justify-between border-b border-ink pb-3">
        <h3 className="text-[20px] font-bold">리뷰 <span className="num">{comma(total)}</span></h3>
        <span className="text-[12px] text-mute">구매확정 후 작성된 리뷰만 노출됩니다</span>
      </div>
      <div className="grid sm:grid-cols-[200px_1fr_1fr] gap-8 py-8 border-b border-line">
        <div className="text-center sm:border-r border-line sm:pr-8">
          <div className="text-[46px] font-bold leading-none num">{avg.toFixed(1)}</div>
          <Stars value={avg} size={16} className="mt-2" />
        </div>
        <ul className="space-y-1.5 text-[12.5px]">
          {(summary?.distribution ?? []).map((d) => (
            <li key={d.rating}>
              <button onClick={() => changeStar(starFilter === d.rating ? 0 : d.rating)} className={cx('w-full flex items-center gap-2.5', starFilter && starFilter !== d.rating && 'opacity-40')}>
                <span className="w-6 text-left">{d.rating}점</span>
                <span className="flex-1 h-1.5 bg-sand"><span className="block h-full bg-ink" style={{ width: `${(d.count / (total || 1)) * 100}%` }} /></span>
                <span className="w-9 text-right num text-mute">{Math.round((d.count / (total || 1)) * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
        {fits ? (
          <div className="text-[12.5px]">
            <div className="font-semibold mb-2">사이즈</div>
            {fits.map(({ fit, count }) => {
              const tot = fits.reduce((a, x) => a + x.count, 0) || 1;
              const top = count > 0 && count === Math.max(...fits.map((x) => x.count));
              return (
                <div key={fit} className="flex items-center gap-2.5 mb-1.5">
                  <span className={cx('w-12', top && 'font-bold')}>{FIT_LABELS[fit]}</span>
                  <span className="flex-1 h-1.5 bg-sand"><span className={cx('block h-full', top ? 'bg-point' : 'bg-line-2')} style={{ width: `${(count / tot) * 100}%` }} /></span>
                  <span className="w-9 text-right num text-mute">{Math.round((count / tot) * 100)}%</span>
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
          <div className="text-[13px] font-semibold mb-3 flex items-center gap-1.5"><Camera size={15} strokeWidth={1.7} /> 포토 리뷰 <span className="num text-mute">{comma(photoPage.totalElements)}</span></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {photos.map((r) => <img key={r.id} src={r.photos[0]} alt="" className="w-24 h-24 object-cover shrink-0" />)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-line text-[13px]">
        <div className="flex items-center gap-4">
          <Checkbox checked={photoOnly} onChange={changePhotoOnly} label="포토 리뷰만" />
          {starFilter > 0 && <button onClick={() => changeStar(0)} className="inline-flex items-center gap-1 h-7 px-2 bg-sand">{starFilter}점만<X size={12} /></button>}
        </div>
        <div className="flex gap-3">
          {SORTS.map(([k, l]) => (
            <button key={k} onClick={() => changeSort(k)} className={sort === k ? 'font-bold' : 'text-mute'}>{l}</button>
          ))}
        </div>
      </div>

      {isLoading && <p className="py-10 text-center text-mute text-[13px]">불러오는 중…</p>}
      {isError && <p className="py-10 text-center text-mute text-[13px]">리뷰를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      {data && list.length === 0 && (
        <p className="py-10 text-center text-mute text-[13px]">{starFilter || photoOnly ? '조건에 맞는 리뷰가 없어요' : '아직 작성된 리뷰가 없어요'}</p>
      )}
      <ul>
        {list.map((r) => (
          <li key={r.id} className="py-6 border-b border-line">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] font-semibold">{r.writer}</div>
              {canReport && <button onClick={() => setReportTarget({ type: 'REVIEW', id: r.id, label: '리뷰' })} className="text-[11.5px] text-mute hover:text-ink shrink-0">신고</button>}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-mute"><Stars value={r.rating} size={11} /> {ymd(r.date)}</div>
            <div className="mt-3 text-[12px] text-mute">{r.option && <>옵션: {r.option}</>}{r.fit && <>{r.option && ' · '}사이즈 <b className="text-ink-2">{FIT_LABELS[r.fit]}</b></>}</div>
            {r.title && <p className="mt-2 text-[14px] font-semibold">{r.title}</p>}
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{r.body}</p>
            {r.photos.length > 0 && <div className="mt-3 flex gap-2">{r.photos.map((src) => <img key={src} src={src} alt="" className="w-28 h-28 object-cover" />)}</div>}
            {r.reply && (
              <div className="mt-4 bg-cream p-4 text-[13px]">
                <div className="font-bold mb-1">{store.name} <span className="font-normal text-mute text-[11px] ml-1">판매자 답글</span></div>
                <p className="text-ink-2 leading-relaxed whitespace-pre-line">{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <BlockPager className="mt-8" pageIndex={page} pageCount={data?.totalPages ?? 0} onPage={setPage} />
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </section>
  );
}
