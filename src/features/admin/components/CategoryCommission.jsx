// 카테고리 · 수수료 — 담당 구지훈
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PageHead, Modal } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { toast } from '@/shared/stores/toastStore';
import { pct, cx } from '@/shared/utils/format';

const DOCS_BY_CAT = { food: '영업신고증 / 농업경영체', beauty: '화장품 책임판매업 등록필증', digital: 'KC 인증서' };

// 상위 · 하위 행을 한 줄씩 펼친 데이터. 정렬은 상위 카테고리 값으로만 비교해 하위 행이 상위 바로 아래에 붙어 있게 한다
// (동률이면 TanStack 이 원래 순서로 정렬 → 하위 행 순서 유지). 검색은 상위 행에 하위 이름까지, 하위 행에 상위 이름까지 넣어 함께 걸리게
const byParent = (key) => (a, b) => {
  const x = a.original.parent[key], y = b.original.parent[key];
  return typeof x === 'string' ? x.localeCompare(y) : x - y;
};

function buildColumns({ open, toggle, setEdit }) {
  return [
    {
      id: 'name', accessorFn: (r) => (r.sub ? `${r.parent.name} ${r.sub}` : `${r.parent.name} ${r.parent.subs.join(' ')}`),
      header: '카테고리', sortingFn: byParent('name'),
      cell: ({ row }) => {
        const r = row.original;
        if (r.sub) return <span className="inline-block pl-7 text-ink-2"><span className="text-line-2 mr-1.5">└</span>{r.sub}</span>;
        return (
          <button onClick={() => toggle(r.parent.id)} className="flex items-center gap-1.5 font-semibold">
            <ChevronRight size={14} className={cx('transition-transform', open.has(r.parent.id) && 'rotate-90')} />
            {r.parent.name} <span className="text-[11px] text-mute font-normal">하위 {r.parent.subs.length}</span>
          </button>
        );
      },
    },
    { id: 'code', accessorFn: (r) => (r.sub ? `${r.parent.id}/${r.sub}` : r.parent.id), header: '코드', sortingFn: byParent('id'), meta: { tdClass: 'font-mono text-[11.5px] text-mute' } },
    {
      id: 'prodCount', accessorFn: (r) => r.prodCount, header: '상품', sortingFn: byParent('prodCount'),
      meta: { thClass: 'text-right', tdClass: 'text-right num', search: false },
    },
    {
      id: 'storeCount', accessorFn: (r) => r.parent.storeCount, header: '스토어', sortingFn: byParent('storeCount'),
      meta: { thClass: 'text-right', tdClass: 'text-right num', search: false },
      cell: ({ row }) => (row.original.sub ? <span className="text-mute">-</span> : row.original.parent.storeCount),
    },
    {
      id: 'commission', accessorFn: (r) => r.parent.commission, header: '판매수수료', sortingFn: byParent('commission'),
      meta: { thClass: 'w-36', search: false },
      cell: ({ row }) => {
        const { parent, sub } = row.original;
        if (sub) return <span className="text-[12.5px] text-mute">상위와 동일 ({pct(parent.commission)})</span>;
        return <div className="flex items-center gap-1"><input className="field field-sm num w-20" defaultValue={(parent.commission * 100).toFixed(1)} /> %</div>;
      },
    },
    {
      id: 'pgFee', header: '결제수수료', enableSorting: false, meta: { thClass: 'text-right', tdClass: 'text-right num', search: false },
      cell: ({ row }) => <span className={cx(row.original.sub && 'text-mute')}>{pct(PAYMENT_FEE, 1)}</span>,
    },
    {
      id: 'total', accessorFn: (r) => r.parent.commission + PAYMENT_FEE, header: '합계', sortingFn: byParent('commission'),
      meta: { thClass: 'text-right', tdClass: 'text-right num', search: false },
      cell: ({ row, getValue }) => <span className={row.original.sub ? 'text-mute' : 'font-semibold'}>{pct(getValue(), 1)}</span>,
    },
    {
      id: 'docs', accessorFn: (r) => (r.sub ? '' : DOCS_BY_CAT[r.parent.id] || '-'), header: '필수 인증 서류', sortingFn: byParent('id'),
      meta: { tdClass: 'text-[12.5px] text-ink-2' },
    },
    {
      id: 'action', header: '관리', enableSorting: false, meta: { thClass: 'text-center', search: false },
      cell: ({ row }) => {
        const { parent, sub, prodCount } = row.original;
        if (sub) {
          return (
            <div className="flex gap-1 justify-center">
              <button onClick={() => setEdit({ mode: 'edit', parent: parent.id, name: sub })} className="btn btn-line btn-xs">수정</button>
              <button onClick={() => toast(prodCount ? '상품이 등록된 카테고리는 삭제할 수 없어요' : '삭제했어요') /* TODO(구지훈): useDeleteCategoryMutation */} className="btn btn-ghost btn-xs">삭제</button>
            </div>
          );
        }
        return (
          <div className="flex gap-1 justify-center">
            <button onClick={() => setEdit({ mode: 'new', parent: parent.id })} className="btn btn-line btn-xs">하위 추가</button>
            <button onClick={() => setEdit({ mode: 'edit', parent: '', name: parent.name })} className="btn btn-line btn-xs">수정</button>
          </div>
        );
      },
    },
  ];
}

export default function CategoryCommission() {
  const { data: categories = [], isLoading, isError } = useAdminCategoriesQuery();
  const { data: stores = [] } = useAdminStoresQuery();
  const { data: products = [] } = useAdminProductsQuery();
  const [openSel, setOpenSel] = useState(null); // null = 처음 상태(첫 상위 카테고리만 펼침)
  const open = useMemo(() => openSel ?? new Set(categories.slice(0, 1).map((c) => c.id)), [openSel, categories]);
  const [edit, setEdit] = useState(null);

  const rows = useMemo(() => categories.flatMap((c) => {
    const parent = {
      ...c,
      prodCount: products.filter((p) => p.cat === c.id).length,
      storeCount: stores.filter((s) => s.cat === c.id).length,
    };
    const head = { id: c.id, parent, sub: null, prodCount: parent.prodCount };
    if (!open.has(c.id)) return [head];
    return [head, ...c.subs.map((s) => ({ id: `${c.id}-${s}`, parent, sub: s, prodCount: products.filter((p) => p.cat === c.id && p.sub === s).length }))];
  }), [categories, products, stores, open]);

  const columns = useMemo(() => {
    const toggle = (id) => setOpenSel(() => { const n = new Set(open); n.has(id) ? n.delete(id) : n.add(id); return n; });
    return buildColumns({ open, toggle, setEdit });
  }, [open]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: rows, columns, pageSize: 50 });

  const handleReserve = () => {
    // TODO(구지훈): useReserveCommissionMutation
    toast('변경 사항이 2026.10.08부터 적용 예약되었어요');
  };
  const handleSave = () => {
    // TODO(구지훈): useSaveCategoryMutation
    setEdit(null);
    toast('저장했어요');
  };

  return (
    <div>
      <PageHead title="카테고리 · 수수료" desc="상위 / 하위 2단계 카테고리 · 판매자는 상품 등록 시 이 목록에서만 선택합니다 · 수수료율 변경은 판매자 공지 후 7일 뒤 적용"
        right={<>
          <button onClick={() => setEdit({ mode: 'new', parent: '' })} className="btn btn-line btn-sm">+ 상위 카테고리</button>
          <button onClick={handleReserve} className="btn btn-ink btn-sm">수수료 변경 예약</button>
        </>} />
      <div className="flex flex-wrap items-center gap-2 mb-3 text-[12.5px]">
        <button onClick={() => setOpenSel(new Set(categories.map((c) => c.id)))} className="btn btn-line btn-xs">모두 펼치기</button>
        <button onClick={() => setOpenSel(new Set())} className="btn btn-line btn-xs">모두 접기</button>
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="카테고리명 · 코드 · 인증 서류" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === 'edit' ? '카테고리 수정' : '카테고리 추가'} width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setEdit(null)}>취소</button><button className="btn btn-ink btn-sm" onClick={handleSave}>저장</button></>}>
        {edit && (
          <div className="space-y-3">
            <div>
              <label className="label">상위 카테고리</label>
              <select className="field" defaultValue={edit.parent}>
                <option value="">없음 (상위 카테고리로 등록)</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">카테고리명</label><input className="field" defaultValue={edit.name || ''} placeholder="예: 셔츠" /></div>
            {!edit.parent && <div><label className="label">판매수수료 (%)</label><input className="field num" placeholder="예: 10.0" /></div>}
            <div><label className="label">노출 순서</label><input className="field num" defaultValue="1" /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
