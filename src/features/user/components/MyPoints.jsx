// 마이페이지 포인트 — 담당 이경석. 전체 1회 로드 후 화면에서 구분 탭 · 검색 · 정렬 · 페이징 (컨벤션 4-7)
import { useMemo, useState } from 'react';
import { StatusPill, Segments } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useMyPointsQuery } from '@/features/user/hooks/useMyPointsQuery';
import { POINT_RATE, POINT_TYPES } from '@/features/user/constants';
import { cx, comma, ymd } from '@/shared/utils/format';

const COLUMNS = [
  {
    accessorKey: 'date', header: '일자', sortingFn: 'datetime', meta: { thClass: 'w-28', tdClass: 'text-mute num' },
    cell: ({ getValue }) => ymd(getValue()),
  },
  { accessorKey: 'type', header: '구분', meta: { thClass: 'w-16' }, cell: ({ getValue }) => <StatusPill s={getValue()} /> },
  {
    id: 'desc', accessorFn: (r) => `${r.desc} ${r.ref}`, header: '내용',
    cell: ({ row }) => <><div>{row.original.desc}</div><div className="text-[11.5px] text-mute num">{row.original.ref}</div></>,
  },
  {
    accessorKey: 'amount', header: '포인트', meta: { thClass: 'text-right', tdClass: 'text-right num font-semibold' },
    cell: ({ getValue }) => <span className={cx(getValue() < 0 && 'text-rust')}>{getValue() > 0 ? '+' : ''}{comma(getValue())}P</span>,
  },
  {
    accessorKey: 'balance', header: '잔액', meta: { thClass: 'text-right hidden sm:table-cell', tdClass: 'text-right num text-ink-2 hidden sm:table-cell' },
    cell: ({ getValue }) => `${comma(getValue())}P`,
  },
];

export default function MyPoints() {
  const [type, setType] = useState('전체');
  const { data, isLoading, isError } = useMyPointsQuery();
  const history = useMemo(() => data?.history ?? [], [data]);
  const balance = data?.balance ?? 0;
  const counts = useMemo(
    () => Object.fromEntries([['전체', history.length], ...POINT_TYPES.map((t) => [t, history.filter((r) => r.type === t).length])]),
    [history],
  );
  const sums = useMemo(
    () => Object.fromEntries(POINT_TYPES.map((t) => [t, history.filter((r) => r.type === t).reduce((a, r) => a + Math.abs(r.amount), 0)])),
    [history],
  );
  const columnFilters = useMemo(() => (type === '전체' ? [] : [{ id: 'type', value: type }]), [type]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({
    data: history,
    columns: COLUMNS,
    columnFilters,
    initialSorting: [{ id: 'date', desc: true }],
  });

  return (
    <div>
      <MyPageHead>포인트</MyPageHead>
      <div className="grid grid-cols-2 md:grid-cols-5 border border-line">
        <div className="col-span-2 md:col-span-1 p-5 bg-ink text-white">
          <div className="text-[12px] text-white/60">보유 포인트</div>
          <div className="text-[26px] font-bold num mt-1">{comma(balance)}<span className="text-[15px] ml-0.5">P</span></div>
        </div>
        {POINT_TYPES.map((t, i) => (
          <div key={t} className={cx('p-5', i % 2 === 1 && 'border-l border-line', i > 0 && 'md:border-l', i < 2 && 'border-b md:border-b-0 border-line')}>
            <div className="text-[12px] text-mute">누적 {t}</div>
            <div className={cx('text-[18px] font-bold num mt-1', (t === '사용' || t === '회수') && 'text-ink-2')}>{t === '사용' || t === '회수' ? '−' : '+'}{comma(sums[t])}P</div>
          </div>
        ))}
      </div>
      <div className="mt-6 mb-4 flex flex-wrap gap-3 items-center">
        <Segments items={['전체', ...POINT_TYPES]} value={type} onChange={setType} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="내용 · 주문번호" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="포인트 내역이 없어요" />
      <div className="mt-6 bg-cream p-5 text-[13px] text-ink-2 leading-relaxed">
        <b className="text-ink">포인트 안내</b><br />
        · 결제 시 실결제금액(포인트 사용분 제외)의 {POINT_RATE * 100}%가 적립되며, 다음 결제부터 사용할 수 있어요.<br />
        · 사용 · 적립 포인트는 상품주문 단위로 금액 비율에 따라 나뉘어 기록돼요.<br />
        · 취소 · 반품이 완료되면 그 상품주문분 사용 포인트는 환원, 적립 포인트는 회수됩니다.
      </div>
    </div>
  );
}
