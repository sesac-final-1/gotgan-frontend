// 리뷰 작성 모달 — 담당 이경석
import { useMemo, useState } from 'react';
import { Star, Camera } from 'lucide-react';
import { Modal } from '@/shared/components/ui';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { cx } from '@/shared/utils/format';

export default function MyReviewModal({ line, onClose }) {
  const [star, setStar] = useState(5);
  const [hover, setHover] = useState(0);
  const [fit, setFit] = useState('정사이즈');
  const [photo, setPhoto] = useState(false);
  const { data: products = [] } = useProductsQuery();
  const { data: stores = [] } = useStoresQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const storeById = useMemo(() => toMap(stores), [stores]);
  if (!line) return null;
  const p = productById[line.productId];
  if (!p) return null;
  const wear = p.cat === 'fashion' || p.cat === 'shoes-bags';
  const submit = () => {
    // TODO(이경석): useCreateReviewMutation
    onClose();
    toast('리뷰가 등록되었어요');
  };
  return (
    <Modal open onClose={onClose} title="리뷰 쓰기" width={560}
      footer={<><button className="btn btn-line btn-sm" onClick={onClose}>취소</button><button className="btn btn-ink btn-sm" onClick={submit}>등록하기</button></>}>
      <div className="flex gap-3 pb-4 border-b border-line">
        <img src={p.images[0]} alt="" className="w-14 h-16 object-cover" />
        <div className="text-[13px]"><div className="text-mute">{storeById[p.storeId]?.name}</div><div className="font-semibold">{p.name}</div><div className="text-mute">{line.option}</div></div>
      </div>
      <div className="py-5 text-center">
        <div className="text-[14px] font-semibold">상품은 만족하셨나요?</div>
        <div className="mt-3 flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onMouseEnter={() => setHover(i)} onClick={() => setStar(i)}>
              <Star size={34} strokeWidth={0} className={(hover || star) >= i ? 'fill-ink' : 'fill-line-2'} />
            </button>
          ))}
        </div>
        <div className="text-[12px] text-mute mt-1">{['', '별로예요', '그저 그래요', '괜찮아요', '좋아요', '최고예요'][hover || star]}</div>
      </div>
      {wear && (
        <div className="mb-4">
          <div className="label">사이즈는 어땠나요?</div>
          <div className="grid grid-cols-3 gap-2">{['작아요', '정사이즈', '커요'].map((f) => <button key={f} onClick={() => setFit(f)} className={cx('h-10 border text-sm', fit === f ? 'border-ink border-2 font-bold' : 'border-line-2')}>{f}</button>)}</div>
        </div>
      )}
      <label className="label">리뷰 내용</label>
      <textarea rows={5} className="field" placeholder="최소 20자 이상 작성해주세요. 다른 구매자에게 큰 도움이 됩니다." />
      <button onClick={() => setPhoto(!photo)} className={cx('mt-3 w-20 h-20 border flex flex-col items-center justify-center text-[11px] gap-1', photo ? 'border-ink' : 'border-dashed border-line-2 text-mute')}>
        {photo ? <img src={p.images[1]} alt="" className="w-full h-full object-cover" /> : <><Camera size={18} />사진 추가</>}
      </button>
      <p className="mt-3 text-[12px] text-mute">사진은 최대 5장 · 상품과 무관한 내용, 욕설은 운영 정책에 따라 블라인드 처리될 수 있습니다.</p>
    </Modal>
  );
}
