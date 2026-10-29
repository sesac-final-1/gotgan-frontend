// 상품 문의 작성 · 수정 모달 — 담당 이경석. 상품 상세 Q&A · 마이페이지 내 문의가 같이 쓴다
// target: { productId } 면 작성, { inquiry } 면 수정 (inquiry: id · content · secret)
import { useState } from 'react';
import { Modal, Checkbox } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';
import { useCreateInquiryMutation, useUpdateInquiryMutation } from '@/features/review/hooks/useInquiries';

const CONTENT_MAX = 1000;
const errorMessage = (err) => err.response?.data?.message ?? '잠시 후 다시 시도해 주세요.';

export default function InquiryModal({ target, onClose }) {
  if (!target) return null;
  return <InquiryForm key={target.inquiry?.id ?? `new-${target.productId}`} target={target} onClose={onClose} />;
}

function InquiryForm({ target, onClose }) {
  const editing = target.inquiry;
  const [content, setContent] = useState(editing?.content ?? '');
  const [secret, setSecret] = useState(editing?.secret ?? false);
  const [error, setError] = useState('');
  const create = useCreateInquiryMutation();
  const update = useUpdateInquiryMutation();
  const busy = create.isPending || update.isPending;

  const submit = () => {
    const options = {
      onSuccess: () => { toast(editing ? '문의를 수정했어요' : '문의가 등록되었어요. 판매자가 답변하면 Q&A 에서 확인할 수 있어요'); onClose(); },
      onError: (err) => setError(errorMessage(err)),
    };
    const body = { content: content.trim(), secret };
    if (editing) update.mutate({ id: editing.id, ...body }, options);
    else create.mutate({ productId: target.productId, ...body }, options);
  };

  return (
    <Modal open onClose={onClose} title={editing ? '문의 수정' : '상품 문의하기'}
      footer={<>
        <button className="btn btn-line btn-sm" onClick={onClose}>취소</button>
        <button className="btn btn-ink btn-sm" disabled={!content.trim() || busy} onClick={submit}>{editing ? '수정' : '등록'}</button>
      </>}>
      <label className="label" htmlFor="inquiry-content">내용</label>
      <textarea id="inquiry-content" rows={5} maxLength={CONTENT_MAX} value={content} onChange={(e) => setContent(e.target.value)}
        className="field" placeholder="상품에 대해 궁금한 점을 남겨주세요. (개인정보 입력 금지)" />
      <div className="mt-1 text-right text-[11.5px] text-mute num">{content.length} / {CONTENT_MAX.toLocaleString()}</div>
      <Checkbox className="mt-2" checked={secret} onChange={setSecret} label="비밀글로 문의하기 (판매자만 볼 수 있어요)" />
      {error && <p role="alert" className="mt-3 text-[12.5px] text-rust">{error}</p>}
    </Modal>
  );
}
