// 리뷰 작성 · 수정 모달 — 담당 이경석 (backend review.md 1 · 2 · 12절)
// target: { line } 이면 작성(작성 가능 목록의 상품주문), { review } 면 수정(내가 쓴 리뷰)
import { useEffect, useMemo, useState } from 'react';
import { Star, Camera, X } from 'lucide-react';
import { Modal } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { cx } from '@/shared/utils/format';
import { useCreateReviewMutation, useUpdateReviewMutation } from '@/features/review/hooks/useReviewMutations';
import { CONTENT_MAX, CONTENT_MIN, FIT_LABELS, FITS, IMAGE_TYPES, MAX_IMAGE_SIZE, MAX_IMAGES } from '@/features/review/constants';

const STAR_TEXT = ['', '별로예요', '그저 그래요', '괜찮아요', '좋아요', '최고예요'];
const FALLBACK_MESSAGE = '잠시 후 다시 시도해 주세요.';
const errorMessage = (err) => err.response?.data?.message ?? err.message ?? FALLBACK_MESSAGE;

export default function MyReviewModal({ target, onClose }) {
  if (!target) return null;
  return <ReviewForm key={target.review?.id ?? `new-${target.line.lineId}`} target={target} onClose={onClose} />;
}

function ReviewForm({ target, onClose }) {
  const editing = target.review;
  const item = editing ?? target.line; // productName · option · thumbnail 은 둘 다 같은 이름
  const [star, setStar] = useState(editing?.rating ?? 5);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState(editing?.fit ?? null);
  const [body, setBody] = useState(editing?.body ?? '');
  const [keepImages, setKeepImages] = useState(editing?.images ?? []); // [{ key, url }]
  const [newFiles, setNewFiles] = useState([]); // File[]
  const [error, setError] = useState('');
  const create = useCreateReviewMutation();
  const update = useUpdateReviewMutation();
  const saving = create.isPending || update.isPending;

  const previews = useMemo(() => newFiles.map((f) => URL.createObjectURL(f)), [newFiles]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList ?? []);
    if (picked.some((f) => !IMAGE_TYPES.includes(f.type))) return setError('사진은 JPG · PNG · WEBP 만 올릴 수 있어요');
    if (picked.some((f) => f.size > MAX_IMAGE_SIZE)) return setError('사진은 10MB 이하만 올릴 수 있어요');
    if (keepImages.length + newFiles.length + picked.length > MAX_IMAGES) return setError(`사진은 최대 ${MAX_IMAGES}장까지 올릴 수 있어요`);
    setError('');
    setNewFiles((prev) => [...prev, ...picked]);
  };

  const submit = () => {
    const content = body.trim();
    if (content.length < CONTENT_MIN || content.length > CONTENT_MAX) {
      setError(`리뷰 내용은 ${CONTENT_MIN}~${CONTENT_MAX.toLocaleString()}자로 입력해 주세요`);
      return;
    }
    setError('');
    const form = { rating: star, title: editing?.title || null, content, fit, keepKeys: keepImages.map((i) => i.key), newFiles };
    const options = {
      onSuccess: () => { toast(editing ? '리뷰를 수정했어요' : '리뷰가 등록되었어요'); onClose(); },
      onError: (err) => setError(errorMessage(err)),
    };
    if (editing) update.mutate({ id: editing.id, ...form }, options);
    else create.mutate({ orderItemId: target.line.lineId, ...form }, options);
  };

  const imageCount = keepImages.length + newFiles.length;
  return (
    <Modal open onClose={onClose} title={editing ? '리뷰 수정' : '리뷰 쓰기'} width={560}
      footer={<>
        <button className="btn btn-line btn-sm" onClick={onClose}>취소</button>
        <button className="btn btn-ink btn-sm" disabled={saving} onClick={submit}>{editing ? '수정하기' : '등록하기'}</button>
      </>}>
      <div className="flex gap-3 pb-4 border-b border-line">
        {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-14 h-16 object-cover" /> : <span className="w-14 h-16 bg-sand" />}
        <div className="text-[13px]"><div className="font-semibold">{item.productName}</div><div className="text-mute">{item.option}</div></div>
      </div>
      <div className="py-5 text-center">
        <div className="text-[14px] font-semibold">상품은 만족하셨나요?</div>
        <div className="mt-3 flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} aria-label={`별점 ${i}점`} onMouseEnter={() => setHover(i)} onClick={() => setStar(i)}>
              <Star size={34} strokeWidth={0} className={(hover || star) >= i ? 'fill-ink' : 'fill-line-2'} />
            </button>
          ))}
        </div>
        <div className="text-[12px] text-mute mt-1">{STAR_TEXT[hover || star]}</div>
      </div>
      <div className="mb-4">
        <div className="label">사이즈는 어땠나요? <span className="text-mute font-normal">(선택 — 의류 · 신발 · 가방)</span></div>
        <div className="grid grid-cols-3 gap-2">
          {FITS.map((f) => (
            <button key={f} onClick={() => setFit(fit === f ? null : f)}
              className={cx('h-10 border text-sm', fit === f ? 'border-ink border-2 font-bold' : 'border-line-2')}>{FIT_LABELS[f]}</button>
          ))}
        </div>
      </div>
      <label className="label" htmlFor="review-body">리뷰 내용</label>
      <textarea id="review-body" rows={5} className="field" value={body} onChange={(e) => setBody(e.target.value)}
        placeholder={`최소 ${CONTENT_MIN}자 이상 작성해주세요. 다른 구매자에게 큰 도움이 됩니다.`} />
      <div className="mt-1 text-right text-[11.5px] text-mute num">{body.trim().length} / {CONTENT_MAX.toLocaleString()}</div>
      <div className="mt-2 flex gap-2 flex-wrap">
        {keepImages.map((img) => (
          <Thumb key={img.key} src={img.url} onRemove={() => setKeepImages((prev) => prev.filter((i) => i.key !== img.key))} />
        ))}
        {previews.map((src, i) => (
          <Thumb key={src} src={src} onRemove={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))} />
        ))}
        {imageCount < MAX_IMAGES && (
          <label className="w-20 h-20 border border-dashed border-line-2 text-mute flex flex-col items-center justify-center text-[11px] gap-1 cursor-pointer">
            <Camera size={18} />사진 추가
            <input type="file" accept={IMAGE_TYPES.join(',')} multiple className="hidden" aria-label="사진 추가"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      <p className="mt-3 text-[12px] text-mute">사진은 최대 {MAX_IMAGES}장 · 10MB 이하 · 상품과 무관한 내용, 욕설은 운영 정책에 따라 블라인드 처리될 수 있습니다.</p>
      {error && <p role="alert" className="mt-3 text-[13px] text-rust">{error}</p>}
    </Modal>
  );
}

function Thumb({ src, onRemove }) {
  return (
    <div className="relative w-20 h-20">
      <img src={src} alt="" className="w-full h-full object-cover" />
      <button onClick={onRemove} aria-label="사진 빼기" className="absolute top-0.5 right-0.5 bg-black/60 text-white p-0.5"><X size={12} /></button>
    </div>
  );
}
