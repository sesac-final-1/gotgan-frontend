// 상품 상세 · Q&A 영역 — 담당 이경석. 탭 숫자는 상품 상세가 같은 쿼리(첫 페이지 totalElements)로 읽는다
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Lock } from 'lucide-react';
import { Pill } from '@/shared/components/ui';
import { BlockPager } from '@/shared/components/common/BlockPager';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useDeleteInquiryMutation, useProductInquiriesQuery } from '@/features/review/hooks/useInquiries';
import InquiryModal from '@/features/review/components/InquiryModal';
import { toast } from '@/shared/stores/toastStore';
import { comma, ymd } from '@/shared/utils/format';

export default function ShopProductQna({ p }) {
  const navigate = useNavigate();
  const loggedIn = useAuthStore((s) => !!s.user);
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState(null); // { productId } 작성 · { inquiry } 수정
  const { data, isLoading, isError } = useProductInquiriesQuery(p.id, page);
  const remove = useDeleteInquiryMutation();
  const list = data?.content ?? [];

  const write = () => (loggedIn ? setTarget({ productId: p.id }) : navigate('/login'));
  const onDelete = (q) => {
    if (!window.confirm('문의를 삭제할까요?')) return;
    remove.mutate(q.id, {
      onSuccess: () => toast('문의를 삭제했어요'),
      onError: (err) => toast(err.response?.data?.message ?? '잠시 후 다시 시도해 주세요.'),
    });
  };

  return (
    <section id="qna" className="scroll-mt-32 pt-16">
      <div className="flex items-center justify-between border-b border-ink pb-3">
        <h3 className="text-[20px] font-bold">Q&A <span className="num">{comma(data?.totalElements ?? 0)}</span></h3>
        <button onClick={write} className="btn btn-line btn-sm">문의하기</button>
      </div>
      {isLoading && <p className="py-10 text-center text-sm text-mute">불러오는 중…</p>}
      {isError && <p className="py-10 text-center text-sm text-mute">문의를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      <ul>
        {data && list.length === 0 && <li className="py-10 text-center text-sm text-mute">등록된 문의가 없습니다.</li>}
        {list.map((q) => (
          <li key={q.id} className="py-4 border-b border-line text-[13.5px]">
            <div className="flex items-center gap-2 text-[12px] text-mute">
              <Pill tone={q.answered ? 'mute' : 'line'}>{q.answered ? '답변완료' : '답변대기'}</Pill>
              {q.writer} · {ymd(q.date)}
              {q.mine && (
                <span className="ml-auto flex gap-2">
                  {!q.answered && <button onClick={() => setTarget({ inquiry: q })} className="underline">수정</button>}
                  <button onClick={() => onDelete(q)} disabled={remove.isPending} className="underline">삭제</button>
                </span>
              )}
            </div>
            {q.content == null ? (
              <p className="mt-2 flex items-center gap-1.5 text-mute"><Lock size={13} /> 비밀글입니다.</p>
            ) : (
              <>
                <p className="mt-2 whitespace-pre-line"><b className="mr-2">Q</b>{q.secret && <Lock size={12} className="inline mr-1 text-mute" />}{q.content}</p>
                {q.answer && <p className="mt-2 text-ink-2 whitespace-pre-line"><b className="mr-2 text-point">A</b>{q.answer}</p>}
              </>
            )}
          </li>
        ))}
      </ul>
      <BlockPager className="mt-6" pageIndex={page} pageCount={data?.totalPages ?? 0} onPage={setPage} />
      <InquiryModal target={target} onClose={() => setTarget(null)} />
    </section>
  );
}
