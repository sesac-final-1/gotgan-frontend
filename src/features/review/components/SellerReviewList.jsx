// 판매자 리뷰 관리 — 담당 이경석
import { useCallback, useMemo, useState } from 'react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { PageHead, Segments, Stars, Modal, Pill, HBars } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { useReplyReviewMutation, useSellerReviewSummaryQuery, useSellerReviewsQuery } from '@/features/review/hooks/useSellerReviews';
import { useCreateReportMutation } from '@/features/report/hooks/useCreateReportMutation';
import { SELLER_REQUEST } from '@/features/report/constants';
import { toast } from '@/shared/stores/toastStore';
import { ymd } from '@/shared/utils/format';

const PAGE_SIZE = 10;
const REPLY_MAX = 1000;
// 탭 이름 → 서버 tab 값 · 요약 tabCounts 필드
const TABS = { 전체: ['ALL', 'all'], '답글 미작성': ['NO_REPLY', 'noReply'], '1~2점': ['LOW_RATING', 'lowRating'], 포토: ['PHOTO', 'photo'] };
const errorMessage = (err) => err.response?.data?.message ?? '잠시 후 다시 시도해 주세요.';

// 답글 입력칸 — 행마다 입력 중인 글을 따로 들고 있다. 답글이 있으면 보여 주고 "수정"으로 다시 연다 (서버는 덮어씀)
function ReplyBox({ r, onSubmit, pending }) {
  const [editing, setEditing] = useState(!r.reply);
  const [draft, setDraft] = useState(r.reply ?? '');
  if (r.blinded) return <p className="text-[12px] text-mute">블라인드된 리뷰에는 답글을 달 수 없어요</p>;
  if (!editing) {
    return <div className="bg-cream p-4 text-[13px]"><div className="text-[11.5px] text-mute mb-1">내 답글</div><p className="text-ink-2 whitespace-pre-line">{r.reply}</p><button onClick={() => { setDraft(r.reply); setEditing(true); }} className="mt-2 text-[12px] text-mute underline">수정</button></div>;
  }
  const content = draft.trim();
  return (
    <div>
      <textarea rows={3} value={draft} maxLength={REPLY_MAX} onChange={(e) => setDraft(e.target.value)} className="field text-[13px]" placeholder="고객에게 답글을 남겨주세요" />
      <div className="flex justify-between items-center mt-2">
        <button onClick={() => setDraft(r.rating >= 4 ? '소중한 후기 감사합니다! 다음에도 만족하실 수 있도록 준비하겠습니다.' : '불편을 드려 죄송합니다. 말씀해주신 부분 꼭 개선하겠습니다.')} className="text-[12px] text-sky">자주 쓰는 답글</button>
        <div className="flex gap-1.5">
          {r.reply && <button onClick={() => setEditing(false)} className="btn btn-ghost btn-xs">취소</button>}
          <button disabled={!content || pending} onClick={() => onSubmit(r.id, content, () => setEditing(false))} className="btn btn-ink btn-xs">{r.reply ? '저장' : '등록'}</button>
        </div>
      </div>
    </div>
  );
}

// 열 정의는 콜백 · 검토 요청 목록이 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ onReply, replyPending, onFlag, flagged }) {
  return [
    {
      accessorKey: 'rating', header: '평점', meta: { tdClass: 'whitespace-nowrap' },
      cell: ({ getValue }) => <div className="flex items-center gap-1.5 text-[12px]"><Stars value={getValue()} size={12} /><b className="text-[13px]">{getValue()}.0</b></div>,
    },
    {
      id: 'body', header: '리뷰',
      cell: ({ row: { original: r } }) => (
        <div className="min-w-[280px] max-w-[420px] whitespace-normal">
          <div className="flex items-center gap-2 text-[12px] flex-wrap">
            {r.blinded && <Pill tone="rust">블라인드</Pill>}
            {!r.blinded && flagged.has(r.id) && <Pill tone="amber">검토 요청됨</Pill>}
            {!r.blinded && !flagged.has(r.id) && <button onClick={() => onFlag(r)} className="text-[12px] text-mute underline">관리자 검토 요청</button>}
          </div>
          {r.title && <p className="mt-1 text-[14px] font-semibold">{r.title}</p>}
          <p className="mt-1 text-[13.5px] text-ink-2 leading-relaxed">{r.body}</p>
          {r.photos.length > 0 && <div className="mt-2 flex gap-1.5">{r.photos.map((src) => <img key={src} src={src} alt="" className="w-20 h-20 object-cover" />)}</div>}
        </div>
      ),
    },
    {
      accessorKey: 'productName', header: '상품',
      cell: ({ row: { original: r } }) => <div className="min-w-[160px] text-[13px]">{r.productName}<div className="text-[11.5px] text-mute">{r.option}</div></div>,
    },
    { accessorKey: 'writer', header: '작성자', meta: { tdClass: 'whitespace-nowrap' } },
    { accessorKey: 'date', header: '작성일', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' }, cell: ({ getValue }) => ymd(getValue()) },
    {
      id: 'reply', header: '답글', meta: { tdClass: 'w-[340px] min-w-[280px]' },
      cell: ({ row: { original: r } }) => <ReplyBox key={`${r.id}-${r.reply ?? ''}`} r={r} onSubmit={onReply} pending={replyPending} />,
    },
  ];
}

export default function SellerReviewList() {
  const [tab, setTab] = useState('전체');
  const [prod, setProd] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [flagTarget, setFlagTarget] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagError, setFlagError] = useState('');
  const [flagged, setFlagged] = useState(() => new Set()); // 이번에 검토 요청한 리뷰 — 서버 목록엔 요청 여부가 없다

  const { data: summary } = useSellerReviewSummaryQuery();
  const { data, isLoading, isError } = useSellerReviewsQuery({
    tab: TABS[tab][0], productId: prod === 'all' ? undefined : prod, page: pageIndex, size: PAGE_SIZE,
  });
  const rows = useMemo(() => data?.content ?? [], [data]);
  const products = summary?.products ?? [];
  const byProduct = products.map((p) => ({ label: p.productName, value: p.averageRating, note: `${p.count}건` }));
  const counts = summary && Object.fromEntries(Object.entries(TABS).map(([label, [, field]]) => [label, summary.tabCounts[field]]));
  const avg = summary?.averageRating ?? 0;
  const ratedCount = summary?.ratedCount ?? 0;

  const { mutate: replyMutate, isPending: replyPending } = useReplyReviewMutation();
  const onReply = useCallback((id, content, done) => replyMutate({ id, content }, {
    onSuccess: () => { done(); toast('답글을 등록했어요'); },
    onError: (err) => toast(errorMessage(err)),
  }), [replyMutate]);
  const report = useCreateReportMutation();
  const onFlag = useCallback((r) => { setFlagTarget(r); setFlagReason(''); setFlagError(''); }, []);
  const submitFlag = () => report.mutate({ targetType: 'REVIEW', targetId: flagTarget.id, reasonCode: SELLER_REQUEST, detail: flagReason.trim() }, {
    onSuccess: () => {
      setFlagged((prev) => new Set(prev).add(flagTarget.id));
      setFlagTarget(null); toast('검토 요청을 보냈어요. 관리자가 확인 후 블라인드 여부를 결정합니다');
    },
    onError: (err) => setFlagError(errorMessage(err)),
  });

  const columns = useMemo(() => buildColumns({ onReply, replyPending, onFlag, flagged }), [onReply, replyPending, onFlag, flagged]);
  const table = useReactTable({
    data: rows, columns, getCoreRowModel: getCoreRowModel(),
    manualPagination: true, pageCount: data?.totalPages ?? 0,
    state: { pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (u) => setPageIndex((typeof u === 'function' ? u({ pageIndex, pageSize: PAGE_SIZE }) : u).pageIndex),
  });
  // 탭 · 상품이 바뀌면 1페이지로
  const changeTab = (t) => { setTab(t); setPageIndex(0); };
  const changeProd = (p) => { setProd(p); setPageIndex(0); };

  return (
    <div>
      <PageHead title="리뷰 관리" desc="답글은 쇼핑몰 상품 상세에 공개됩니다. 판매자는 리뷰를 삭제할 수 없으며, 운영 정책 위반 리뷰는 관리자가 블라인드 처리합니다." />
      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <div className="panel p-5 text-center">
          <div className="text-[13px] text-mute">스토어 평균 평점</div>
          <div className="text-[44px] font-bold num leading-none mt-2">{avg.toFixed(2)}</div>
          <Stars value={avg} size={16} className="mt-2" />
          <ul className="mt-5 space-y-1.5 text-[12px] text-left">
            {(summary?.distribution ?? []).map((d) => (
              <li key={d.rating} className="flex items-center gap-2"><span className="w-6">{d.rating}점</span><span className="flex-1 h-1.5 bg-sand"><span className="block h-full bg-ink" style={{ width: `${ratedCount ? (d.count / ratedCount) * 100 : 0}%` }} /></span><span className="w-7 text-right num text-mute">{d.count}</span></li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <div className="panel-title mb-4">상품별 평균 평점</div>
          <HBars rows={byProduct} format={(v) => `★ ${v.toFixed(2)}`} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-4 items-center">
        <Segments items={Object.keys(TABS)} value={tab} onChange={changeTab} counts={counts} />
        <select aria-label="상품" value={prod} onChange={(e) => changeProd(e.target.value)} className="field field-sm h-9 w-auto ml-auto">
          <option value="all">전체 상품</option>{products.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
        </select>
      </div>

      <DataTable table={table} loading={isLoading} error={isError} className="mt-3" />

      <Modal open={!!flagTarget} onClose={() => setFlagTarget(null)} title="관리자 검토 요청"
        footer={<>
          <button onClick={() => setFlagTarget(null)} className="btn btn-ghost btn-sm">취소</button>
          <button disabled={!flagReason.trim() || report.isPending} onClick={submitFlag} className="btn btn-ink btn-sm">요청</button>
        </>}>
        <p className="text-[13px] text-ink-2">판매자는 리뷰를 삭제하거나 가릴 수 없습니다. 욕설 · 광고 · 허위 사실 등 정책 위반이 의심되면 사유를 적어 관리자에게 검토를 요청하세요.</p>
        <textarea rows={3} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} className="field text-[13px] mt-3" placeholder="예: 상품과 무관한 광고성 내용" />
        {flagError && <p className="mt-2 text-[12px] text-rust">{flagError}</p>}
      </Modal>
    </div>
  );
}
