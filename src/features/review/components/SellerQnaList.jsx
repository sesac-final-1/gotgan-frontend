// 판매자 상품 문의 — 담당 이경석 (backend review.md 18 ~ 20절)
import { useCallback, useMemo, useState } from 'react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Lock } from 'lucide-react';
import { PageHead, Segments, StatusPill } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import {
  INQUIRY_PAGE_SIZE, useAnswerInquiryMutation, useSellerInquiriesQuery, useSellerInquirySummaryQuery,
} from '@/features/review/hooks/useInquiries';
import { toast } from '@/shared/stores/toastStore';
import { ymd } from '@/shared/utils/format';

const ANSWER_MAX = 1000;
// 탭 이름 → 서버 tab 값 · 숫자 응답 필드
const TABS = { 미답변: ['UNANSWERED', 'unanswered'], 답변완료: ['ANSWERED', 'answered'], 전체: ['ALL', 'all'] };

// 답변 입력칸 — 행마다 입력 중인 글을 따로 들고 있다. 답변이 있으면 보여 주고 "수정"으로 다시 연다 (서버는 덮어씀)
function AnswerBox({ q, onSubmit, pending }) {
  const [editing, setEditing] = useState(!q.answer);
  const [draft, setDraft] = useState(q.answer ?? '');
  if (!editing) {
    return (
      <div className="mt-2 text-[14px] text-ink-2 bg-cream p-3">
        <p className="whitespace-pre-line"><b className="mr-2 text-point">A</b>{q.answer}</p>
        <button onClick={() => { setDraft(q.answer); setEditing(true); }} className="mt-1 text-[12px] text-mute underline">수정</button>
      </div>
    );
  }
  const content = draft.trim();
  return (
    <div className="mt-3 flex gap-2">
      <input value={draft} maxLength={ANSWER_MAX} onChange={(e) => setDraft(e.target.value)} className="field" placeholder="답변을 입력하세요" />
      {q.answer && <button onClick={() => setEditing(false)} className="btn btn-ghost shrink-0">취소</button>}
      <button disabled={!content || pending} onClick={() => onSubmit(q.id, content, () => setEditing(false))} className="btn btn-ink shrink-0">
        {q.answer ? '답변 저장' : '답변 등록'}
      </button>
    </div>
  );
}

// 열 정의는 답변 콜백이 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ onAnswer, answerPending }) {
  return [
    {
      id: 'state', header: '상태', meta: { tdClass: 'whitespace-nowrap' },
      cell: ({ row: { original: q } }) => (
        <span className="inline-flex items-center gap-1.5 text-mute"><StatusPill s={q.answer ? '답변완료' : '미답변'} />{q.secret && <Lock size={12} aria-label="비밀글" />}</span>
      ),
    },
    { accessorKey: 'productName', header: '상품', meta: { tdClass: 'text-ink-2 min-w-[160px]' } },
    {
      id: 'qa', header: '문의 · 답변',
      cell: ({ row: { original: q } }) => (
        <div className="min-w-[320px] py-2">
          <p className="text-[14px] whitespace-pre-line"><b className="mr-2">Q</b>{q.content}</p>
          <AnswerBox key={`${q.id}-${q.answer ?? ''}`} q={q} onSubmit={onAnswer} pending={answerPending} />
        </div>
      ),
    },
    { accessorKey: 'writer', header: '작성자', meta: { tdClass: 'whitespace-nowrap' } },
    { accessorKey: 'date', header: '작성일', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' }, cell: ({ getValue }) => ymd(getValue()) },
  ];
}

export default function SellerQnaList() {
  const [tab, setTab] = useState('미답변');
  const [pageIndex, setPageIndex] = useState(0);
  const { data, isLoading, isError } = useSellerInquiriesQuery({ tab: TABS[tab][0], page: pageIndex, size: INQUIRY_PAGE_SIZE });
  const { data: summary } = useSellerInquirySummaryQuery();
  const rows = useMemo(() => data?.content ?? [], [data]);
  const counts = summary && Object.fromEntries(Object.entries(TABS).map(([label, [, field]]) => [label, summary[field]]));

  const { mutate: answerMutate, isPending: answerPending } = useAnswerInquiryMutation();
  const onAnswer = useCallback((id, content, done) => answerMutate({ id, content }, {
    onSuccess: () => { done(); toast('답변을 등록했어요'); },
    onError: (err) => toast(err.response?.data?.message ?? '잠시 후 다시 시도해 주세요.'),
  }), [answerMutate]);
  const columns = useMemo(() => buildColumns({ onAnswer, answerPending }), [onAnswer, answerPending]);
  const table = useReactTable({
    data: rows, columns, getCoreRowModel: getCoreRowModel(),
    manualPagination: true, pageCount: data?.totalPages ?? 0,
    state: { pagination: { pageIndex, pageSize: INQUIRY_PAGE_SIZE } },
    onPaginationChange: (u) => setPageIndex((typeof u === 'function' ? u({ pageIndex, pageSize: INQUIRY_PAGE_SIZE }) : u).pageIndex),
  });
  const changeTab = (t) => { setTab(t); setPageIndex(0); };

  return (
    <div>
      <PageHead title="상품 문의" desc="평균 답변 시간은 스토어 신뢰도 지표에 반영됩니다. (목표: 24시간 이내)" />
      <Segments items={Object.keys(TABS)} value={tab} onChange={changeTab} counts={counts} />
      <DataTable table={table} loading={isLoading} error={isError} empty="문의가 없습니다." className="mt-3" />
    </div>
  );
}
