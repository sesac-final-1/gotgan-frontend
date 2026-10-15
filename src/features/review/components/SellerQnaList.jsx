// 판매자 상품 문의 — 담당 이경석
import { useCallback, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { PageHead, Segments, StatusPill } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useQnasQuery } from '@/features/review/hooks/useQnasQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useSellerBuyersQuery } from '@/features/order/hooks/useSellerBuyersQuery';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { ymd } from '@/shared/utils/format';

const TABS = ['미답변', '답변완료', '전체'];

// 답변 입력칸 — 행마다 입력 중인 글을 따로 들고 있다 (목업 draft 객체와 같은 동작)
function AnswerBox({ q, onSubmit }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="mt-3 flex gap-2">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} className="field" placeholder="답변을 입력하세요" />
      <button disabled={!draft} onClick={() => onSubmit(q.id, draft)} className="btn btn-ink shrink-0">답변 등록</button>
    </div>
  );
}

// 열 정의는 상품 · 회원 Map 이 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ productById, userById, onAnswer }) {
  return [
    {
      id: 'state', accessorFn: (q) => (q.a ? '답변완료' : '미답변'), header: '상태', meta: { tdClass: 'whitespace-nowrap' },
      cell: ({ row: { original: q }, getValue }) => <span className="inline-flex items-center gap-1.5 text-mute"><StatusPill s={getValue()} />{q.secret && <Lock size={12} />}</span>,
    },
    { id: 'product', accessorFn: (q) => productById[q.productId]?.name ?? '', header: '상품', meta: { tdClass: 'text-ink-2 min-w-[160px]' } },
    {
      id: 'qa', accessorFn: (q) => `${q.q} ${q.a ?? ''}`, header: '문의 · 답변',
      cell: ({ row: { original: q } }) => (
        <div className="min-w-[320px] py-2">
          <p className="text-[14px]"><b className="mr-2">Q</b>{q.q}</p>
          {q.a ? <p className="mt-2 text-[14px] text-ink-2 bg-cream p-3"><b className="mr-2 text-point">A</b>{q.a}</p> : <AnswerBox key={q.id} q={q} onSubmit={onAnswer} />}
        </div>
      ),
    },
    { id: 'user', accessorFn: (q) => userById[q.userId]?.name ?? '', header: '작성자', meta: { tdClass: 'whitespace-nowrap' } },
    { accessorKey: 'date', header: '작성일', sortingFn: 'datetime', meta: { tdClass: 'num text-ink-2 whitespace-nowrap' }, cell: ({ getValue }) => ymd(getValue()) },
  ];
}

export default function SellerQnaList() {
  const { data: qnas = [], isLoading, isError } = useQnasQuery();
  const { data: products = [] } = useProductsQuery();
  const { data: store } = useMyStoreQuery();
  // TODO(이경석): 판매자 문의 응답에 작성자명 포함되면 useSellerBuyersQuery 제거
  const { data: users = [] } = useSellerBuyersQuery();
  const [answers, setAnswers] = useState({}); // 목업 흉내: 문의 id → 등록한 답변
  const [tab, setTab] = useState('미답변');

  const productById = useMemo(() => toMap(products), [products]);
  const userById = useMemo(() => toMap(users), [users]);
  const rows = useMemo(
    () => qnas.filter((q) => productById[q.productId]?.storeId === store?.id).map((q) => (answers[q.id] ? { ...q, a: answers[q.id] } : q)),
    [qnas, productById, store, answers],
  );
  const list = useMemo(() => rows.filter((q) => tab === '전체' || (tab === '미답변' ? !q.a : q.a)), [rows, tab]);

  // TODO(이경석): useAnswerQnaMutation
  const onAnswer = useCallback((id, a) => { setAnswers((prev) => ({ ...prev, [id]: a })); toast('답변을 등록했어요 (구매자 알림 발송)'); }, []);
  const columns = useMemo(() => buildColumns({ productById, userById, onAnswer }), [productById, userById, onAnswer]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: list, columns, initialSorting: [{ id: 'date', desc: true }] });

  return (
    <div>
      <PageHead title="상품 문의" desc="평균 답변 시간은 스토어 신뢰도 지표에 반영됩니다. (목표: 24시간 이내)" />
      <div className="flex flex-wrap gap-3 items-center">
        <Segments items={TABS} value={tab} onChange={setTab} counts={{ 미답변: rows.filter((q) => !q.a).length, 답변완료: rows.filter((q) => q.a).length, 전체: rows.length }} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="문의 내용 · 상품 · 작성자" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="문의가 없습니다." className="mt-3" />
    </div>
  );
}
