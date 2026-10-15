// 리뷰 관리 — 담당 구지훈
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHead, Segments, StatusPill, Checkbox, Stars } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';
import { useAdminUsersQuery } from '@/features/admin/hooks/useAdminUsersQuery';
import { useAdminStoresQuery } from '@/features/admin/hooks/useAdminStoresQuery';
import { useAdminProductsQuery } from '@/features/admin/hooks/useAdminProductsQuery';
import { toMap } from '@/shared/utils/collection';
import { toast } from '@/shared/stores/toastStore';
import { ymd } from '@/shared/utils/format';

const TABS = ['검토 대상', '블라인드', '전체'];
const match = (r, t) => (t === '검토 대상' ? r.flag && !r.blinded : t === '블라인드' ? r.blinded : true);
const reviewState = (r) => (r.blinded ? '블라인드' : r.flag ? '검토대기' : '정상노출');

// 처리 버튼이 컴포넌트 핸들러를 쓰므로 열 정의를 useMemo 로 (컨벤션 4-7)
function buildColumns(decide) {
  return [
    {
      id: 'body', accessorKey: 'body', header: '리뷰', sortingFn: (a, b) => a.original.date - b.original.date, // 정렬은 작성일 기준
      meta: { tdClass: 'max-w-[320px]' },
      cell: ({ row }) => <><div className="flex items-center gap-1.5 text-[11.5px] text-mute"><Stars value={row.original.rating} size={10} /> {ymd(row.original.date)}</div><p className="mt-0.5 line-clamp-2">{row.original.body}</p></>,
    },
    {
      id: 'photo', header: '사진', enableSorting: false, meta: { search: false },
      cell: ({ row }) => (row.original.photos[0] ? <img src={row.original.photos[0]} alt="" className="w-10 h-10 object-cover" /> : <span className="text-mute">-</span>),
    },
    {
      id: 'product', accessorFn: (r) => `${r.productName} ${r.storeName}`, header: '상품 / 스토어', meta: { tdClass: 'text-[12.5px]' },
      cell: ({ row }) => <>{row.original.productName}<div className="text-mute">{row.original.storeName}</div></>,
    },
    {
      accessorKey: 'userName', header: '작성자',
      cell: ({ row }) => <Link to={`/admin/users/${row.original.userId}`} className="hover:underline">{row.original.userName}</Link>,
    },
    { id: 'flag', accessorFn: (r) => r.flag ?? '', header: '검토 사유', meta: { tdClass: 'text-[12.5px]' }, cell: ({ getValue }) => getValue() || <span className="text-mute">-</span> },
    { id: 'state', accessorFn: reviewState, header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    {
      id: 'action', header: '처리', enableSorting: false, meta: { thClass: 'text-center', search: false },
      cell: ({ row }) => (
        <div className="flex gap-1 justify-center">
          {!row.original.blinded && <button onClick={() => decide(row.original, true)} className="btn btn-ink btn-xs">블라인드</button>}
          {(row.original.blinded || row.original.flag) && <button onClick={() => decide(row.original, false)} className="btn btn-line btn-xs">정상노출</button>}
        </div>
      ),
    },
  ];
}

export default function ReviewModeration() {
  const [tab, setTab] = useState('검토 대상');
  const [photo, setPhoto] = useState(false);
  const [blindById, setBlindById] = useState({}); // 처리 결과는 목업처럼 로컬 상태로만 반영
  const { data: reviews = [], isLoading, isError } = useAdminReviewsQuery();
  const { data: users = [] } = useAdminUsersQuery();
  const { data: stores = [] } = useAdminStoresQuery();
  const { data: products = [] } = useAdminProductsQuery();

  const rows = useMemo(() => {
    const productById = toMap(products), storeById = toMap(stores), userById = toMap(users);
    return reviews.slice(0, 40).concat(reviews.slice(40).filter((r) => r.flag)).map((r) => {
      const p = productById[r.productId];
      return {
        ...r,
        blinded: blindById[r.id] ?? r.blinded,
        productName: p?.name ?? r.productId,
        storeName: storeById[p?.storeId ?? r.storeId]?.name ?? '',
        userName: userById[r.userId]?.name ?? r.userId,
      };
    });
  }, [reviews, products, stores, users, blindById]);
  const list = useMemo(() => rows.filter((r) => match(r, tab) && (!photo || r.photos.length)), [rows, tab, photo]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t, rows.filter((r) => match(r, t)).length])), [rows]);

  const columns = useMemo(() => buildColumns((r, blind) => {
    // TODO(구지훈): useBlindReviewMutation
    setBlindById((prev) => ({ ...prev, [r.id]: blind }));
    toast(blind ? '블라인드 처리했어요' : '정상 노출로 변경했어요');
  }), []);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: list, columns });

  return (
    <div>
      <PageHead title="리뷰 관리" desc="별점 · 사진 리뷰 모니터링 · 운영 정책 위반 리뷰는 블라인드 처리 (판매자는 리뷰를 삭제할 수 없음)" />
      <div className="flex flex-wrap gap-3 items-center">
        <Segments items={TABS} value={tab} onChange={setTab} counts={counts} />
        <Checkbox checked={photo} onChange={setPhoto} label="사진 리뷰만" className="ml-auto" />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="내용 · 상품 · 스토어 · 작성자" />
      </div>
      <div className="mt-3">
        <DataTable table={table} loading={isLoading} error={isError} empty="해당하는 리뷰가 없습니다." />
      </div>
    </div>
  );
}
