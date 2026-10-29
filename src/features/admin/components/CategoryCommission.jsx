// 카테고리 · 수수료 — 담당 구지훈
import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PageHead, Modal } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminCategoriesQuery } from '@/features/admin/hooks/useAdminCategoriesQuery';
import { useReserveCommissionMutation, useSaveCategoryMutation } from '@/features/admin/hooks/useCategoryMutations';
import { PAYMENT_FEE } from '@/features/settlement/constants';
import { toast } from '@/shared/stores/toastStore';
import { pct, cx } from '@/shared/utils/format';

// 상위 · 하위 행을 한 줄씩 펼친 데이터. 정렬은 상위 카테고리 값으로만 비교해 하위 행이 상위 바로 아래에 붙어 있게 한다
// (동률이면 TanStack 이 원래 순서로 정렬 → 하위 행 순서 유지). 검색은 상위 행에 하위 이름까지, 하위 행에 상위 이름까지 넣어 함께 걸리게
const byParent = (key) => (a, b) => {
  const x = a.original.parent[key], y = b.original.parent[key];
  return typeof x === 'string' ? x.localeCompare(y) : x - y;
};

const rateText = (c) => (c.commission == null ? '' : String(Math.round(c.commission * 10000) / 100)); // 0.115 → '11.5'

function buildColumns({ open, toggle, setEdit, rates, setRate, toggleActive }) {
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
      // 스토어 수 칸은 뺌(10/29) — 스토어는 여러 카테고리를 팔고 수수료는 상품의 상위 카테고리 기준이라 스토어 수가 영향 범위와 맞지 않음
      id: 'prodCount', accessorFn: (r) => r.prodCount, header: '상품', sortingFn: byParent('prodCount'),
      meta: { thClass: 'text-right', tdClass: 'text-right num', search: false },
      cell: ({ getValue }) => (getValue() == null ? <span className="text-mute">-</span> : getValue()),
    },
    {
      id: 'commission', accessorFn: (r) => r.parent.commission, header: '판매수수료', sortingFn: byParent('commission'),
      meta: { thClass: 'w-36', search: false },
      cell: ({ row }) => {
        const { parent, sub } = row.original;
        if (sub) return <span className="text-[12.5px] text-mute">상위와 동일 ({parent.commission == null ? '미등록' : pct(parent.commission)})</span>;
        return (
          <div className="flex items-center gap-1">
            <input className="field field-sm num w-20" value={rates[parent.categoryId] ?? rateText(parent)} onChange={(e) => setRate(parent.categoryId, e.target.value)} /> %
          </div>
        );
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
      id: 'action', header: '관리', enableSorting: false, meta: { thClass: 'text-center', search: false },
      cell: ({ row }) => {
        const { parent, sub } = row.original;
        // 카테고리는 삭제하지 않고 사용 중지만 (store · settlement 가 category_id 를 참조 — product.md 7절)
        const target = sub ? parent.children.find((c) => c.name === sub) : parent;
        const editOf = (c, parentId) => ({ mode: 'edit', categoryId: c.categoryId ?? c.id, parentId, name: c.name, nameEn: c.nameEn ?? c.en ?? '', sortOrder: String(c.sortOrder), active: c.active });
        return (
          <div className="flex gap-1 justify-center">
            {!sub && <button onClick={() => setEdit({ mode: 'new', parentId: String(parent.categoryId), name: '', sortOrder: '' })} className="btn btn-line btn-xs">하위 추가</button>}
            <button onClick={() => setEdit(editOf(target, sub ? String(parent.categoryId) : ''))} className="btn btn-line btn-xs">수정</button>
            <button onClick={() => toggleActive(target)} className="btn btn-ghost btn-xs">{target.active ? '사용 중지' : '사용'}</button>
          </div>
        );
      },
    },
  ];
}

export default function CategoryCommission() {
  const { data: categories = [], isLoading, isError } = useAdminCategoriesQuery();
  const [openSel, setOpenSel] = useState(null); // null = 처음 상태(첫 상위 카테고리만 펼침)
  const open = useMemo(() => openSel ?? new Set(categories.slice(0, 1).map((c) => c.id)), [openSel, categories]);
  const [edit, setEdit] = useState(null);

  const rows = useMemo(() => categories.flatMap((c) => {
    const parent = { ...c, prodCount: c.productCount };
    const head = { id: c.id, parent, sub: null, prodCount: parent.prodCount };
    if (!open.has(c.id)) return [head];
    return [head, ...c.children.map((s) => ({ id: `${c.id}-${s.name}`, parent, sub: s.name, prodCount: s.productCount ?? null }))];
  }), [categories, open]);

  const [rates, setRates] = useState({}); // categoryId → 입력한 율(%) 문자열 — 바뀐 것만 예약
  const saveCategory = useSaveCategoryMutation();
  const reserveCommission = useReserveCommissionMutation();
  const fail = (err) => toast(err.response?.data?.message ?? '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');

  const toggleActive = (c) => saveCategory.mutate(
    { categoryId: c.categoryId ?? c.id, request: { name: c.name, nameEn: c.nameEn ?? c.en ?? null, sortOrder: c.sortOrder, active: !c.active } },
    { onSuccess: () => toast(c.active ? '사용 중지했어요' : '사용으로 바꿨어요'), onError: fail },
  );
  const columns = useMemo(() => {
    const toggle = (id) => setOpenSel(() => { const n = new Set(open); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const setRate = (id, v) => setRates((r) => ({ ...r, [id]: v }));
    return buildColumns({ open, toggle, setEdit, rates, setRate, toggleActive });
  }, [open, rates]); // eslint-disable-line react-hooks/exhaustive-deps -- toggleActive 는 mutate 래퍼라 매 렌더 같은 동작
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: rows, columns, pageSize: 50 });

  const handleReserve = () => {
    const changed = categories
      .filter((c) => rates[c.categoryId] !== undefined && rates[c.categoryId] !== rateText(c))
      .map((c) => ({ categoryId: c.categoryId, rate: Number(rates[c.categoryId]) }));
    if (!changed.length) { toast('바뀐 수수료가 없어요'); return; }
    reserveCommission.mutate(changed, {
      onSuccess: () => { setRates({}); toast('다음 주 월요일부터 적용되도록 예약했어요'); },
      onError: fail,
    });
  };
  const handleSave = () => {
    const isNew = edit.mode === 'new';
    const top = !edit.parentId;
    const request = isNew
      ? { parentId: top ? null : Number(edit.parentId), name: edit.name, sortOrder: edit.sortOrder ? Number(edit.sortOrder) : null, ...(top ? { commissionRate: Number(edit.rate) } : {}) }
      : { name: edit.name, nameEn: edit.nameEn || null, sortOrder: Number(edit.sortOrder), active: edit.active };
    saveCategory.mutate({ categoryId: isNew ? null : edit.categoryId, request }, {
      onSuccess: () => { setEdit(null); toast('저장했어요'); },
      onError: fail,
    });
  };
  const setField = (k) => (e) => setEdit((v) => ({ ...v, [k]: e.target.value }));

  return (
    <div>
      <PageHead title="카테고리 · 수수료" desc="상위 / 하위 2단계 카테고리 · 판매자는 상품 등록 시 이 목록에서만 선택합니다 · 수수료율 변경은 판매자 공지 후 7일 뒤 적용"
        right={<>
          <button onClick={() => setEdit({ mode: 'new', parentId: '', name: '', sortOrder: '', rate: '' })} className="btn btn-line btn-sm">+ 상위 카테고리</button>
          <button onClick={handleReserve} disabled={reserveCommission.isPending} className="btn btn-ink btn-sm">수수료 변경 예약</button>
        </>} />
      <div className="flex flex-wrap items-center gap-2 mb-3 text-[12.5px]">
        <button onClick={() => setOpenSel(new Set(categories.map((c) => c.id)))} className="btn btn-line btn-xs">모두 펼치기</button>
        <button onClick={() => setOpenSel(new Set())} className="btn btn-line btn-xs">모두 접기</button>
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="카테고리명 · 코드" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === 'edit' ? '카테고리 수정' : '카테고리 추가'} width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setEdit(null)}>취소</button><button className="btn btn-ink btn-sm" onClick={handleSave} disabled={saveCategory.isPending}>저장</button></>}>
        {edit && (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="cat-parent">상위 카테고리</label>
              {/* 상위 · 하위 이동은 안 됨(수수료 기준이 바뀜 — product.md 결정 11) → 수정할 때는 고정 */}
              <select id="cat-parent" className="field" value={edit.parentId} onChange={setField('parentId')} disabled={edit.mode === 'edit'}>
                <option value="">없음 (상위 카테고리로 등록)</option>
                {categories.map((c) => <option key={c.id} value={String(c.categoryId)}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="cat-name">카테고리명</label><input id="cat-name" className="field" value={edit.name} onChange={setField('name')} placeholder="예: 셔츠" /></div>
            {edit.mode === 'new' && !edit.parentId && (
              <div><label className="label" htmlFor="cat-rate">판매수수료 (%)</label><input id="cat-rate" className="field num" value={edit.rate} onChange={setField('rate')} placeholder="예: 10.0 — 오늘부터 적용" /></div>
            )}
            <div><label className="label" htmlFor="cat-sort">노출 순서</label><input id="cat-sort" className="field num" value={edit.sortOrder} onChange={setField('sortOrder')} placeholder="비우면 맨 뒤" /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
