// 마이페이지 클레임 내역 — 담당 이경석 (GET /api/claims). 전체 1회 로드 후 화면에서 유형 탭 · 검색 · 정렬 · 페이징 (컨벤션 4-7)
// 목업의 행 펼침(상세) 은 DataTable 에 펼침 행이 없어 같은 내용을 모달로 띄운다
import { useMemo, useState } from 'react';
import { StatusPill, Segments, Modal } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useMyClaimsQuery } from '@/features/order/hooks/useClaimsQuery';
import { CLAIM_TYPE_LABEL } from '@/features/order/constants';
import { claimProgress, claimStatusLabel, reasonLabel } from '@/features/order/utils/claimView';
import { toDate } from '@/features/order/utils/orderView';
import { comma, won, ymd } from '@/shared/utils/format';

const TYPES = ['전체', '취소', '반품', '교환'];

function buildColumns(onOpen) {
  return [
    {
      id: 'product', accessorFn: (c) => `${c.productName} ${c.optionName ?? ''}`, header: '상품',
      cell: ({ row: { original: c } }) => (
        <div className="flex items-center gap-3 py-1.5"><img src={c.thumbnailUrl} alt="" className="w-12 h-14 object-cover bg-cream" /><span className="font-medium">{c.productName}<br /><span className="text-mute font-normal">{c.optionName || '단일상품'}</span></span></div>
      ),
    },
    { id: 'type', accessorFn: (c) => CLAIM_TYPE_LABEL[c.type], header: '유형' },
    { id: 'reason', accessorFn: (c) => reasonLabel(c.reasonCode), header: '사유', meta: { thClass: 'hidden sm:table-cell', tdClass: 'text-ink-2 hidden sm:table-cell' } },
    {
      id: 'requested', accessorFn: (c) => toDate(c.requestedAt), header: '신청일', sortingFn: 'datetime', meta: { thClass: 'hidden sm:table-cell', tdClass: 'num hidden sm:table-cell' },
      cell: ({ getValue }) => ymd(getValue()),
    },
    { id: 'status', accessorFn: (c) => claimStatusLabel(c), header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    {
      id: 'action', header: '', enableSorting: false, meta: { search: false, tdClass: 'text-right' },
      cell: ({ row }) => <button onClick={() => onOpen(row.original)} className="btn btn-line btn-xs">상세</button>,
    },
  ];
}

export default function MyClaims() {
  const [type, setType] = useState('전체');
  const [open, setOpen] = useState(null);
  const { data: claims = [], isLoading, isError } = useMyClaimsQuery();
  const counts = useMemo(() => {
    const c = { 전체: claims.length, 취소: 0, 반품: 0, 교환: 0 };
    claims.forEach((x) => { c[CLAIM_TYPE_LABEL[x.type]] += 1; });
    return c;
  }, [claims]);
  const columns = useMemo(() => buildColumns(setOpen), []);
  const columnFilters = useMemo(() => (type === '전체' ? [] : [{ id: 'type', value: type }]), [type]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({
    data: claims,
    columns,
    columnFilters,
    initialSorting: [{ id: 'requested', desc: true }],
  });

  return (
    <div>
      <MyPageHead>취소 · 반품 · 교환</MyPageHead>
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <Segments items={TYPES} value={type} onChange={setType} counts={counts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="상품 · 옵션 · 사유" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="신청한 클레임이 없어요" />
      <div className="mt-6 bg-cream p-5 text-[13px] text-ink-2 leading-relaxed">
        <b className="text-ink">처리 안내</b><br />
        · 결제완료 상태: 즉시 취소<br />
        · 반품/교환: 배송완료 후 7일 이내 신청 가능 · 구매확정 후에는 신청 불가 · 판매자 승인 → 회수 → 환불(반품) · 재배송(교환)<br />
        · 취소 · 반품 완료 시 그 상품주문분 사용 포인트는 환원, 적립 포인트는 회수됩니다.
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${CLAIM_TYPE_LABEL[open.type]} 상세` : ''} width={560}
        footer={<button className="btn btn-line btn-sm" onClick={() => setOpen(null)}>닫기</button>}>
        {open && (
          <div className="space-y-4">
            <div className="text-[13px] space-y-1.5">
              <div><span className="text-mute w-24 inline-block">상품주문번호</span><span className="num">{open.itemNo}</span></div>
              <div><span className="text-mute w-24 inline-block">사유</span>{reasonLabel(open.reasonCode)}{open.reasonDetail && ` · ${open.reasonDetail}`}</div>
              <div><span className="text-mute w-24 inline-block">신청일</span><span className="num">{ymd(toDate(open.requestedAt))}</span></div>
              <div><span className="text-mute w-24 inline-block">처리 상태</span>{claimProgress(open)}</div>
              {open.type === 'EXCHANGE' && open.trackingNo && <div><span className="text-mute w-24 inline-block">재배송</span><span className="num">{open.courier} {open.trackingNo}</span></div>}
            </div>
            {open.type !== 'EXCHANGE' && open.status !== 'REJECTED' && (
              <div className="bg-cream p-5 text-[14px] space-y-2">
                <div className="flex justify-between"><span className="text-ink-2">상품 금액</span><span className="num">{won(open.itemAmt)}</span></div>
                <div className="flex justify-between text-moss"><span className="text-ink-2">사용 포인트 환원</span><span className="num">+{comma(open.restorePoint)}P</span></div>
                <div className="flex justify-between font-bold border-t border-line-2 pt-2"><span>결제수단 환불{open.status === 'COMPLETED' ? '' : ' 예정'} 금액</span><span className="num">{won(open.refundAmt)}</span></div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
