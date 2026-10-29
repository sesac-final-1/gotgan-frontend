// 마이페이지 상품 문의 — 담당 이경석. 카드형 목록(표 아님) — 내가 쓴 문의 · 판매자 답변 (backend review.md 14 · 15 · 17절)
import { useState } from 'react';
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { Empty, Pill, Modal } from '@/shared/components/ui';
import { BlockPager } from '@/shared/components/common/BlockPager';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useDeleteInquiryMutation, useMyInquiriesQuery } from '@/features/review/hooks/useInquiries';
import InquiryModal from '@/features/review/components/InquiryModal';
import { toast } from '@/shared/stores/toastStore';
import { ymd } from '@/shared/utils/format';

const Thumbnail = ({ src }) => (src ? <img src={src} alt="" className="w-16 h-20 object-cover" /> : <span className="w-16 h-20 bg-sand shrink-0" />);

export default function MyQna() {
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState(null); // { inquiry } 수정
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading, isError } = useMyInquiriesQuery(page);
  const remove = useDeleteInquiryMutation();
  const list = data?.content ?? [];

  const confirmDelete = () => remove.mutate(deleting.id, {
    onSuccess: () => { toast('문의를 삭제했어요'); setDeleting(null); },
    onError: (err) => toast(err.response?.data?.message ?? '잠시 후 다시 시도해 주세요.'),
  });

  return (
    <div>
      <MyPageHead>상품 문의</MyPageHead>
      {isLoading && <p className="text-mute py-10 text-center">불러오는 중…</p>}
      {isError && <p className="text-mute py-10 text-center">문의를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      {data && list.length === 0 && (
        <Empty title="작성한 문의가 없어요" desc="상품 상세 페이지의 Q&A 탭에서 문의할 수 있어요." action={<Link to="/help" className="btn btn-line btn-sm">고객센터 FAQ 보기</Link>} />
      )}
      <ul>
        {list.map((q) => (
          <li key={q.id} className="py-5 border-b border-line flex gap-4">
            <Link to={`/products/${q.productId}#qna`}><Thumbnail src={q.thumbnail} /></Link>
            <div className="flex-1 text-[13px] min-w-0">
              <Link to={`/products/${q.productId}#qna`} className="font-medium hover:underline">{q.productName}</Link>
              <div className="flex items-center gap-2 text-mute mt-0.5">
                <Pill tone={q.answered ? 'mute' : 'line'}>{q.answered ? '답변완료' : '답변대기'}</Pill>
                {ymd(q.date)}
                {q.secret && <span className="inline-flex items-center gap-1"><Lock size={12} /> 비밀글</span>}
              </div>
              <p className="mt-2 text-ink-2 whitespace-pre-line"><b className="mr-2 text-ink">Q</b>{q.content}</p>
              {q.answered && <p className="mt-2 bg-cream p-3 text-ink-2 whitespace-pre-line"><b className="mr-2 text-point">A</b>{q.answer}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              {!q.answered && <button onClick={() => setTarget({ inquiry: q })} className="btn btn-line btn-xs">수정</button>}
              <button onClick={() => setDeleting(q)} className="btn btn-ghost btn-xs">삭제</button>
            </div>
          </li>
        ))}
      </ul>
      <BlockPager className="mt-6" pageIndex={page} pageCount={data?.totalPages ?? 0} onPage={setPage} />
      <InquiryModal target={target} onClose={() => setTarget(null)} />
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="문의 삭제"
        footer={<>
          <button onClick={() => setDeleting(null)} className="btn btn-line btn-sm">취소</button>
          <button onClick={confirmDelete} disabled={remove.isPending} className="btn btn-ink btn-sm">삭제</button>
        </>}>
        <p className="text-[13px] text-ink-2">삭제하면 되돌릴 수 없어요. 판매자 답변도 함께 보이지 않게 돼요.</p>
      </Modal>
    </div>
  );
}
