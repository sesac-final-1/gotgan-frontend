// 판매자 리뷰 관리 — 담당 이경석
import { useCallback, useMemo, useState } from 'react';
import { PageHead, Segments, Stars, Modal, Pill, HBars } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useReviewsQuery } from '@/features/review/hooks/useReviewsQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useSellerBuyersQuery } from '@/features/order/hooks/useSellerBuyersQuery';
import { ratingSummary } from '@/features/review/utils/ratingSummary';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { ymd, maskName } from '@/shared/utils/format';

const TABS = ['전체', '답글 미작성', '1~2점', '포토'];
const matchTab = (tab, r) => tab === '전체' || (tab === '답글 미작성' && !r.reply) || (tab === '1~2점' && r.rating <= 2) || (tab === '포토' && r.photos.length);

// 답글 입력칸 — 행마다 입력 중인 글을 따로 들고 있다 (목업 draft 객체와 같은 동작)
function ReplyBox({ r, onSubmit }) {
  const [draft, setDraft] = useState('');
  if (r.reply) {
    return <div className="bg-cream p-4 text-[13px]"><div className="text-[11.5px] text-mute mb-1">내 답글</div><p className="text-ink-2">{r.reply}</p><button className="mt-2 text-[12px] text-mute underline">수정</button></div>;
  }
  return (
    <div>
      <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} className="field text-[13px]" placeholder="고객에게 답글을 남겨주세요" />
      <div className="flex justify-between items-center mt-2">
        <button onClick={() => setDraft(r.rating >= 4 ? '소중한 후기 감사합니다! 다음에도 만족하실 수 있도록 준비하겠습니다.' : '불편을 드려 죄송합니다. 말씀해주신 부분 꼭 개선하겠습니다.')} className="text-[12px] text-sky">자주 쓰는 답글</button>
        <button disabled={!draft} onClick={() => onSubmit(r.id, draft)} className="btn btn-ink btn-xs">등록</button>
      </div>
    </div>
  );
}

// 열 정의는 상품 · 회원 Map 이 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ productById, userById, onReply, onFlag }) {
  return [
    {
      accessorKey: 'rating', header: '평점', meta: { tdClass: 'whitespace-nowrap', search: false },
      cell: ({ getValue }) => <div className="flex items-center gap-1.5 text-[12px]"><Stars value={getValue()} size={12} /><b className="text-[13px]">{getValue()}.0</b></div>,
    },
    {
      id: 'body', accessorFn: (r) => `${r.title} ${r.body}`, header: '리뷰',
      cell: ({ row: { original: r } }) => (
        <div className="min-w-[280px] max-w-[420px] whitespace-normal">
          <div className="flex items-center gap-2 text-[12px] flex-wrap">
            {r.blinded && <Pill tone="rust">블라인드</Pill>}
            {!r.blinded && r.flag && <Pill tone="amber">검토 요청됨</Pill>}
            {!r.blinded && !r.flag && <button onClick={() => onFlag(r)} className="text-[12px] text-mute underline">관리자 검토 요청</button>}
          </div>
          <p className="mt-1 text-[14px] font-semibold">{r.title}</p>
          <p className="mt-1 text-[13.5px] text-ink-2 leading-relaxed">{r.body}</p>
          {r.photos[0] && <img src={r.photos[0]} alt="" className="mt-2 w-20 h-20 object-cover" />}
        </div>
      ),
    },
    {
      id: 'product', accessorFn: (r) => productById[r.productId]?.name ?? '', header: '상품',
      cell: ({ row: { original: r }, getValue }) => <div className="min-w-[160px] text-[13px]">{getValue()}<div className="text-[11.5px] text-mute">{r.option}</div></div>,
    },
    { id: 'user', accessorFn: (r) => (userById[r.userId] ? maskName(userById[r.userId].name) : ''), header: '작성자', meta: { tdClass: 'whitespace-nowrap' } },
    { accessorKey: 'date', header: '작성일', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' }, cell: ({ getValue }) => ymd(getValue()) },
    {
      id: 'reply', accessorFn: (r) => r.reply ?? '', header: '답글', enableSorting: false, meta: { tdClass: 'w-[340px] min-w-[280px]' },
      cell: ({ row: { original: r } }) => <ReplyBox key={r.id} r={r} onSubmit={onReply} />,
    },
  ];
}

export default function SellerReviewList() {
  const { data: reviews = [], isLoading, isError } = useReviewsQuery();
  const { data: products = [] } = useProductsQuery();
  const { data: store } = useMyStoreQuery();
  // TODO(이경석): 판매자 리뷰 응답에 작성자명(마스킹) 포함되면 useSellerBuyersQuery 제거
  const { data: users = [] } = useSellerBuyersQuery();
  const [patch, setPatch] = useState({}); // 목업 흉내: 리뷰 id → 등록한 답글 · 검토 요청 사유
  const [tab, setTab] = useState('전체');
  const [prod, setProd] = useState('all');
  const [flagTarget, setFlagTarget] = useState(null);
  const [flagReason, setFlagReason] = useState('');

  const productById = useMemo(() => toMap(products), [products]);
  const userById = useMemo(() => toMap(users), [users]);
  const all = useMemo(() => reviews.filter((r) => r.storeId === store?.id), [reviews, store]);
  const rows = useMemo(() => all.map((r) => (patch[r.id] ? { ...r, ...patch[r.id] } : r)), [all, patch]);
  const list = useMemo(() => rows.filter((r) => (prod === 'all' || r.productId === prod) && matchTab(tab, r)), [rows, prod, tab]);
  const sum = ratingSummary(all);
  const prods = [...new Set(all.map((r) => r.productId))];
  const byProduct = prods.map((pid) => {
    const s = ratingSummary(all.filter((r) => r.productId === pid));
    return { label: productById[pid]?.name ?? pid, value: s.avg, note: `${s.total}건` };
  }).sort((a, b) => b.value - a.value);

  // TODO(이경석): useReplyReviewMutation
  const onReply = useCallback((id, reply) => { setPatch((prev) => ({ ...prev, [id]: { ...prev[id], reply } })); toast('답글을 등록했어요'); }, []);
  const onFlag = useCallback((r) => { setFlagTarget(r); setFlagReason(''); }, []);
  // TODO(이경석): useFlagReviewMutation (관리자 검토 요청)
  const submitFlag = () => {
    setPatch((prev) => ({ ...prev, [flagTarget.id]: { ...prev[flagTarget.id], flag: flagReason.trim() } }));
    setFlagTarget(null); toast('검토 요청을 보냈어요. 관리자가 확인 후 블라인드 여부를 결정합니다');
  };
  const columns = useMemo(() => buildColumns({ productById, userById, onReply, onFlag }), [productById, userById, onReply, onFlag]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: list, columns, initialSorting: [{ id: 'date', desc: true }], pageSize: 10 });

  return (
    <div>
      <PageHead title="리뷰 관리" desc="답글은 쇼핑몰 상품 상세에 공개됩니다. 판매자는 리뷰를 삭제할 수 없으며, 운영 정책 위반 리뷰는 관리자가 블라인드 처리합니다." />
      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <div className="panel p-5 text-center">
          <div className="text-[13px] text-mute">스토어 평균 평점</div>
          <div className="text-[44px] font-bold num leading-none mt-2">{sum.avg.toFixed(2)}</div>
          <Stars value={sum.avg} size={16} className="mt-2" />
          <ul className="mt-5 space-y-1.5 text-[12px] text-left">
            {sum.dist.map((d) => (
              <li key={d.star} className="flex items-center gap-2"><span className="w-6">{d.star}점</span><span className="flex-1 h-1.5 bg-sand"><span className="block h-full bg-ink" style={{ width: `${sum.total ? (d.count / sum.total) * 100 : 0}%` }} /></span><span className="w-7 text-right num text-mute">{d.count}</span></li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <div className="panel-title mb-4">상품별 평균 평점</div>
          <HBars rows={byProduct} format={(v) => `★ ${v.toFixed(2)}`} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-4 items-center">
        <Segments items={TABS} value={tab} onChange={setTab}
          counts={{ 전체: rows.length, '답글 미작성': rows.filter((r) => !r.reply).length, '1~2점': rows.filter((r) => r.rating <= 2).length, 포토: rows.filter((r) => r.photos.length).length }} />
        <select value={prod} onChange={(e) => setProd(e.target.value)} className="field field-sm h-9 w-auto ml-auto">
          <option value="all">전체 상품</option>{prods.map((id) => <option key={id} value={id}>{productById[id]?.name ?? id}</option>)}
        </select>
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="리뷰 내용 · 상품 · 작성자" />
      </div>

      <DataTable table={table} loading={isLoading} error={isError} className="mt-3" />

      <Modal open={!!flagTarget} onClose={() => setFlagTarget(null)} title="관리자 검토 요청"
        footer={<>
          <button onClick={() => setFlagTarget(null)} className="btn btn-ghost btn-sm">취소</button>
          <button disabled={!flagReason.trim()} onClick={submitFlag} className="btn btn-ink btn-sm">요청</button>
        </>}>
        <p className="text-[13px] text-ink-2">판매자는 리뷰를 삭제하거나 가릴 수 없습니다. 욕설 · 광고 · 허위 사실 등 정책 위반이 의심되면 사유를 적어 관리자에게 검토를 요청하세요.</p>
        <textarea rows={3} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} className="field text-[13px] mt-3" placeholder="예: 상품과 무관한 광고성 내용" />
      </Modal>
    </div>
  );
}
