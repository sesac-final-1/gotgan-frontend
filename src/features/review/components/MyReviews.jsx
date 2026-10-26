// 마이페이지 리뷰 관리 — 담당 이경석. 카드형 목록(표 아님)이라 목업 그대로
import { useMemo, useState } from 'react';
import { Stars, Pill } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyOrdersMockQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useReviewsQuery } from '@/features/review/hooks/useReviewsQuery';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import MyReviewModal from '@/features/review/components/MyReviewModal';
import { toMap } from '@/shared/utils/collection';
import { cx, ymd } from '@/shared/utils/format';

export default function MyReviews() {
  const [tab, setTab] = useState('todo');
  const [review, setReview] = useState(null);
  const { data: orders = [] } = useMyOrdersMockQuery();
  const { data: products = [] } = useProductsQuery();
  const { data: reviews = [] } = useReviewsQuery();
  const { data: me } = useMeQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const todo = useMemo(() => orders.flatMap((o) => o.items).filter((l) => l.status === '구매확정' && !l.reviewed), [orders]);
  const mine = useMemo(() => reviews.filter((r) => r.userId === me?.id).slice(0, 6), [reviews, me]);
  return (
    <div>
      <MyPageHead>리뷰 관리</MyPageHead>
      <div className="flex gap-6 border-b border-line mb-5">
        <button onClick={() => setTab('todo')} className={cx('tab', tab === 'todo' && 'tab-on')}>작성 가능한 리뷰 <span className="num text-point">{todo.length}</span></button>
        <button onClick={() => setTab('done')} className={cx('tab', tab === 'done' && 'tab-on')}>내가 쓴 리뷰 <span className="num">{mine.length}</span></button>
      </div>
      {tab === 'todo' ? (
        <div className="space-y-3">
          <p className="text-[13px] text-mute mb-2">구매확정된 상품주문 1건당 1개 · 확정 후 30일 이내 · 별점과 사진(최대 5장)을 남길 수 있어요</p>
          {todo.map((l) => {
            const p = productById[l.productId];
            if (!p) return null;
            return (
              <div key={l.lineId} className="flex items-center gap-4 border border-line p-4">
                <img src={p.images[0]} alt="" className="w-16 h-20 object-cover" />
                <div className="flex-1 text-[13px]"><div className="font-medium text-[14px]">{p.name}</div><div className="text-mute">{l.option} · {ymd(l.date)} 구매</div><div className="text-point text-[12px] mt-1">작성기한 D-{30 - Math.round((Date.now() - l.date) / 864e5) + 14}</div></div>
                <button onClick={() => setReview(l)} className="btn btn-ink btn-sm">리뷰 쓰기</button>
              </div>
            );
          })}
        </div>
      ) : (
        <ul>
          {mine.map((r) => {
            const p = productById[r.productId];
            if (!p) return null;
            return (
              <li key={r.id} className="py-5 border-b border-line flex gap-4">
                <img src={p.images[0]} alt="" className="w-14 h-16 object-cover" />
                <div className="flex-1 text-[13px]">
                  <div className="font-medium">{p.name}</div>
                  <div className="flex items-center gap-2 text-mute mt-0.5"><Stars value={r.rating} size={11} /> {ymd(r.date)} {r.blinded && <Pill tone="rust">블라인드</Pill>}</div>
                  <p className="mt-2 text-ink-2">{r.body}</p>
                  {r.reply && <p className="mt-2 bg-cream p-3 text-ink-2"><b className="text-ink">판매자 답글</b> {r.reply}</p>}
                </div>
                <div className="flex flex-col gap-1.5"><button className="btn btn-line btn-xs">수정</button><button className="btn btn-ghost btn-xs">삭제</button></div>
              </li>
            );
          })}
        </ul>
      )}
      <MyReviewModal line={review} onClose={() => setReview(null)} />
    </div>
  );
}
