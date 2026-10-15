// 판매자 취소 · 반품 · 교환 — 담당 이경석
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHead, Segments, StatusPill, Modal, KV } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { SearchInput } from '@/shared/components/common/SearchInput';
import { useClientTable } from '@/shared/hooks/useClientTable';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { POINT_RATE } from '@/features/user/constants';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { won, comma, ymd, cx } from '@/shared/utils/format';

const NEXT = { 취소요청: '취소완료', 반품요청: '반품완료', 교환요청: '교환완료' };
const SELLER_FAULT = ['상품 불량 (오염)'];

function claimMoney(r, store) {
  const amount = r.unitPrice * r.qty;
  const type = r.claim.type;
  const fee = type === '취소' || SELLER_FAULT.includes(r.claim.reason) ? 0 : (store?.shipFee || 3000) * 2;
  if (type === '교환') return { amount, fee, cash: 0, pointBack: 0, pointTake: 0 };
  const used = r.usedPoint || 0;
  const pointTake = Math.floor((amount - used) * POINT_RATE);
  return { amount, fee, cash: Math.max(0, amount - used - fee), pointBack: used, pointTake };
}

// 열 정의는 상품 Map · 승인 핸들러가 바뀔 때만 새로 만든다 (컨벤션 4-7)
function buildColumns({ productById, approve, setDetail, setReject }) {
  return [
    { accessorKey: 'status', header: '상태', cell: ({ getValue }) => <StatusPill s={getValue()} /> },
    { id: 'type', accessorFn: (r) => r.claim.type, header: '유형', meta: { tdClass: 'font-semibold' } },
    {
      accessorKey: 'lineId', header: '상품주문번호',
      cell: ({ getValue }) => <Link to={`/seller/orders/${getValue()}`} className="num text-sky hover:underline">{getValue()}</Link>,
    },
    {
      id: 'product', accessorFn: (r) => productById[r.productId]?.name ?? '', header: '상품', meta: { tdClass: 'max-w-[220px] truncate' },
      cell: ({ row: { original: r }, getValue }) => <>{getValue()}<div className="text-[11.5px] text-mute">{r.option}</div></>,
    },
    { accessorKey: 'receiver', header: '구매자' },
    { id: 'reason', accessorFn: (r) => r.claim.reason, header: '사유' },
    {
      id: 'requested', accessorFn: (r) => r.claim.requested, header: '요청일', sortingFn: 'datetime',
      cell: ({ row: { original: r } }) => {
        const pastDue = r.status.endsWith('요청') && (Date.now() - r.claim.requested) / 864e5 > 2;
        return <span className={cx('num whitespace-nowrap', pastDue && 'text-rust font-semibold')}>{ymd(r.claim.requested)}{pastDue && ' (기한임박)'}</span>;
      },
    },
    { id: 'amount', accessorFn: (r) => r.unitPrice * r.qty, header: '금액', meta: { thClass: 'text-right', tdClass: 'text-right num' }, cell: ({ getValue }) => won(getValue()) },
    {
      id: 'action', header: '처리', enableSorting: false, meta: { thClass: 'text-center', search: false },
      cell: ({ row: { original: r } }) => {
        const open = r.status.endsWith('요청');
        return (
          <div className="flex gap-1 justify-center">
            <button onClick={() => setDetail(r)} className="btn btn-line btn-xs">상세</button>
            {open && <button onClick={() => approve(r)} className="btn btn-ink btn-xs">{r.claim.type === '교환' ? '재배송' : '승인'}</button>}
            {open && <button onClick={() => setReject(r)} className="btn btn-line btn-xs">거부</button>}
          </div>
        );
      },
    },
  ];
}

export default function SellerClaimList() {
  const { data: orders = [], isLoading, isError } = useSellerOrderItemsQuery();
  const { data: products = [] } = useProductsQuery();
  const { data: store } = useMyStoreQuery();
  const [patch, setPatch] = useState({}); // 목업 흉내: lineId → 처리 후 상태
  const [tab, setTab] = useState('처리대기');
  const [type, setType] = useState('전체');
  const [detail, setDetail] = useState(null);
  const [reject, setReject] = useState(null);

  const productById = useMemo(() => toMap(products), [products]);
  const rows = useMemo(() => orders.filter((o) => o.claim).map((o) => (patch[o.lineId] ? { ...o, status: patch[o.lineId] } : o)), [orders, patch]);
  const byType = useMemo(() => (type === '전체' ? rows : rows.filter((r) => r.claim.type === type)), [rows, type]);
  const pending = useMemo(() => byType.filter((r) => r.status.endsWith('요청')), [byType]);
  const list = useMemo(() => (tab === '처리대기' ? pending : byType.filter((r) => !r.status.endsWith('요청'))), [tab, pending, byType]);
  const typeCounts = { 전체: rows.length, 취소: 0, 반품: 0, 교환: 0 };
  rows.forEach((r) => { typeCounts[r.claim.type] += 1; });

  // TODO(이경석): useApproveClaimMutation
  const approve = useCallback((r) => {
    setPatch((prev) => ({ ...prev, [r.lineId]: NEXT[r.status] }));
    setDetail(null);
    toast(r.claim.type === '교환' ? '교환 상품 재배송 처리했어요' : `${r.claim.type} 승인 · 환불이 진행돼요`);
  }, []);
  // TODO(이경석): useRejectClaimMutation
  const rejectClaim = () => { setReject(null); toast('거부 사유가 구매자에게 전달되었어요'); };

  const columns = useMemo(() => buildColumns({ productById, approve, setDetail, setReject }), [productById, approve]);
  const { table, globalFilter, setGlobalFilter } = useClientTable({ data: list, columns, initialSorting: [{ id: 'requested', desc: true }] });

  return (
    <div>
      <PageHead title="취소 · 반품 · 교환" desc="요청 접수 후 3영업일 내 처리해주세요. 취소 · 반품 승인 시 결제 취소 → 재고 복원 → 구매자 포인트 환원 · 회수가 함께 진행됩니다." />
      <div className="flex flex-wrap gap-2 items-center">
        <Segments items={['처리대기', '처리완료']} value={tab} onChange={setTab} counts={{ 처리대기: pending.length, 처리완료: byType.length - pending.length }} />
        <Segments items={['전체', '취소', '반품', '교환']} value={type} onChange={setType} counts={typeCounts} />
        <SearchInput value={globalFilter} onChange={setGlobalFilter} placeholder="주문번호 · 상품 · 구매자 · 사유" className="ml-auto" />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="처리할 요청이 없습니다." className="mt-3" />

      {detail && (() => {
        const m = claimMoney(detail, store);
        const p = productById[detail.productId];
        const open = detail.status.endsWith('요청');
        return (
          <Modal open onClose={() => setDetail(null)} title={`${detail.claim.type} 요청 상세`} width={560}
            footer={open ? <><button className="btn btn-line btn-sm" onClick={() => { setReject(detail); setDetail(null); }}>거부</button><button className="btn btn-ink btn-sm" onClick={() => approve(detail)}>{detail.claim.type === '교환' ? '재배송 처리' : '승인'}</button></> : <button className="btn btn-line btn-sm" onClick={() => setDetail(null)}>닫기</button>}>
            <div className="flex gap-3 pb-4 border-b border-line text-[13px]">
              <img src={p?.images[0]} alt="" className="w-14 h-16 object-cover" />
              <div className="flex-1"><div className="font-semibold">{p?.name}</div><div className="text-mute">{detail.option} · {detail.qty}개</div><div className="num text-mute">{detail.lineId}</div></div>
              <StatusPill s={detail.status} />
            </div>
            <div className="mt-4"><KV rows={[['유형', detail.claim.type], ['사유', detail.claim.reason], ['요청일', ymd(detail.claim.requested)], ['구매자', detail.receiver], ['송장', detail.invoice ? <span className="num">{detail.courier} {detail.invoice}</span> : '-']]} /></div>
            <div className="mt-4 bg-cream p-4 text-[13px] space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-2">상품 결제금액</span><span className="num">{won(m.amount)}</span></div>
              {detail.claim.type === '교환' ? (
                <div className="flex justify-between"><span className="text-ink-2">교환 배송비 (왕복)</span><span className="num">{m.fee ? won(m.fee) : '판매자 부담'}</span></div>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-ink-2">반품 배송비 (구매자 부담)</span><span className="num">{m.fee ? `−${won(m.fee)}` : '0원'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-2">구매자 사용 포인트 환원</span><span className="num text-moss">+{comma(m.pointBack)}P</span></div>
                  <div className="flex justify-between"><span className="text-ink-2">구매자 적립 포인트 회수</span><span className="num text-rust">−{comma(m.pointTake)}P</span></div>
                  <div className="flex justify-between font-bold border-t border-line-2 pt-1.5"><span>결제수단 환불액 (부분 취소)</span><span className="num">{won(m.cash)}</span></div>
                </>
              )}
            </div>
            <p className="text-[12px] text-mute mt-2">{detail.claim.type === '교환' ? '교환은 결제 · 재고 변동 없이 회수 확인 후 재배송합니다.' : '포인트 환원 · 회수는 회원 포인트에서 처리되며 판매자 정산에서는 해당 상품주문이 제외됩니다.'}</p>
          </Modal>
        );
      })()}

      <Modal open={!!reject} onClose={() => setReject(null)} title="요청 거부" width={460}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setReject(null)}>취소</button><button className="btn btn-ink btn-sm" onClick={rejectClaim}>거부하기</button></>}>
        <label className="label">거부 사유</label>
        <select className="field mb-3"><option>이미 발송된 상품 (반품으로 진행 요청)</option><option>상품 사용 흔적 확인</option><option>반품 기한 경과</option><option>기타</option></select>
        <textarea rows={3} className="field" placeholder="구매자에게 전달할 상세 사유" />
        <p className="text-[12px] text-mute mt-2">거부 사유는 구매자의 취소 · 반품 · 교환 내역에 표시됩니다.</p>
      </Modal>
    </div>
  );
}
