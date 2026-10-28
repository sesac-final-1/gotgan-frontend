// 마이페이지 리뷰 관리 — 담당 이경석. 카드형 목록(표 아님) — 작성 가능한 리뷰 · 내가 쓴 리뷰 (backend review.md 3 ~ 5절)
import { useState } from 'react';
import { Stars, Pill, Modal, Empty } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyReviewsQuery, useWritableReviewsQuery } from '@/features/review/hooks/useMyReviewsQuery';
import { useDeleteReviewMutation } from '@/features/review/hooks/useReviewMutations';
import MyReviewModal from '@/features/review/components/MyReviewModal';
import { FIT_LABELS, MAX_IMAGES } from '@/features/review/constants';
import { toast } from '@/shared/stores/toastStore';
import { cx, ymd } from '@/shared/utils/format';

const DAY = 864e5;
// 작성 기한까지 남은 날 — 오늘이 마지막 날이면 D-0
const dDay = (expiresAt) => Math.max(0, Math.floor((expiresAt - Date.now()) / DAY));

const Thumbnail = ({ src }) => (src ? <img src={src} alt="" className="w-16 h-20 object-cover" /> : <span className="w-16 h-20 bg-sand shrink-0" />);

export default function MyReviews() {
  const [tab, setTab] = useState('todo');
  const [target, setTarget] = useState(null); // { line } 작성 · { review } 수정
  const [deleting, setDeleting] = useState(null);
  const { data: todo = [] } = useWritableReviewsQuery();
  const { data: mine = [] } = useMyReviewsQuery();
  const remove = useDeleteReviewMutation();

  const confirmDelete = () => remove.mutate(deleting.id, {
    onSuccess: () => { toast('리뷰를 삭제했어요'); setDeleting(null); },
    onError: (err) => toast(err.response?.data?.message ?? '잠시 후 다시 시도해 주세요.'),
  });

  return (
    <div>
      <MyPageHead>리뷰 관리</MyPageHead>
      <div className="flex gap-6 border-b border-line mb-5">
        <button onClick={() => setTab('todo')} className={cx('tab', tab === 'todo' && 'tab-on')}>작성 가능한 리뷰 <span className="num text-point">{todo.length}</span></button>
        <button onClick={() => setTab('done')} className={cx('tab', tab === 'done' && 'tab-on')}>내가 쓴 리뷰 <span className="num">{mine.length}</span></button>
      </div>
      {tab === 'todo' ? (
        <div className="space-y-3">
          <p className="text-[13px] text-mute mb-2">구매확정된 상품주문 1건당 1개 · 확정 후 30일 이내 · 별점과 사진(최대 {MAX_IMAGES}장)을 남길 수 있어요</p>
          {todo.length === 0 && <Empty title="작성 가능한 리뷰가 없어요" desc="구매확정한 상품의 리뷰를 여기서 쓸 수 있어요" />}
          {todo.map((l) => (
            <div key={l.lineId} className="flex items-center gap-4 border border-line p-4">
              <Thumbnail src={l.thumbnail} />
              <div className="flex-1 text-[13px]">
                <div className="font-medium text-[14px]">{l.productName}</div>
                <div className="text-mute">{l.option && `${l.option} · `}{ymd(l.date)} 구매확정</div>
                <div className="text-point text-[12px] mt-1">작성기한 D-{dDay(l.expiresAt)}</div>
              </div>
              <button onClick={() => setTarget({ line: l })} className="btn btn-ink btn-sm">리뷰 쓰기</button>
            </div>
          ))}
        </div>
      ) : (
        <ul>
          {mine.length === 0 && <Empty title="아직 쓴 리뷰가 없어요" />}
          {mine.map((r) => (
            <li key={r.id} className="py-5 border-b border-line flex gap-4">
              <Thumbnail src={r.thumbnail} />
              <div className="flex-1 text-[13px]">
                <div className="font-medium">{r.productName}</div>
                <div className="flex items-center gap-2 text-mute mt-0.5">
                  <Stars value={r.rating} size={11} /> {ymd(r.date)}
                  {r.option && <span>· {r.option}</span>}
                  {r.fit && <span>· 사이즈 {FIT_LABELS[r.fit]}</span>}
                  {r.blinded && <Pill tone="rust">블라인드</Pill>}
                </div>
                {r.blinded && <p className="mt-2 text-[12px] text-rust">관리자에 의해 블라인드 처리된 리뷰예요. 다른 구매자에게 보이지 않아요.</p>}
                <p className="mt-2 text-ink-2 whitespace-pre-line">{r.body}</p>
                {r.images.length > 0 && (
                  <div className="mt-2 flex gap-2">{r.images.map((img) => <img key={img.key} src={img.url} alt="" className="w-16 h-16 object-cover" />)}</div>
                )}
                {r.reply && <p className="mt-2 bg-cream p-3 text-ink-2"><b className="text-ink">판매자 답글</b> {r.reply}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                {!r.blinded && <button onClick={() => setTarget({ review: r })} className="btn btn-line btn-xs">수정</button>}
                <button onClick={() => setDeleting(r)} className="btn btn-ghost btn-xs">삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <MyReviewModal target={target} onClose={() => setTarget(null)} />
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="리뷰 삭제"
        footer={<>
          <button onClick={() => setDeleting(null)} className="btn btn-line btn-sm">취소</button>
          <button onClick={confirmDelete} disabled={remove.isPending} className="btn btn-ink btn-sm">삭제</button>
        </>}>
        <p className="text-[13px] text-ink-2">삭제하면 되돌릴 수 없고, 이 상품주문에는 다시 리뷰를 쓸 수 없어요.</p>
      </Modal>
    </div>
  );
}
