// 판매자 취소 · 반품 · 교환 — 담당 이경석 (GET /api/seller/claims — 서버 페이징 · 단계 · 유형 탭, CLM-05)
// 반품: 승인(수거 요청) → 수거 완료(환불) / 교환: 승인 → 수거 완료 → 재배송 송장 → 주문 관리에서 배송완료(또는 자동)하면 교환완료
import { useState } from 'react';
import { Link } from 'react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { PageHead, Segments, StatusPill, Modal, KV } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/common/DataTable';
import { useApproveClaimMutation, useCollectClaimMutation, useRejectClaimMutation, useReshipClaimMutation, useSellerClaimsQuery } from '@/features/order/hooks/useClaimsQuery';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { CLAIM_TYPE_LABEL } from '@/features/order/constants';
import { claimProgress, claimStatusLabel, nextAction, reasonLabel } from '@/features/order/utils/claimView';
import { toDate } from '@/features/order/utils/orderView';
import { toast } from '@/shared/stores/toastStore';
import { won, comma, ymd } from '@/shared/utils/format';

const STAGES = { 처리대기: 'OPEN', 처리완료: 'DONE' };
const TYPES = { 전체: null, 취소: 'CANCEL', 반품: 'RETURN', 교환: 'EXCHANGE' };
const COURIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'];
const REJECT_REASONS = ['상품 사용 흔적 확인', '반품 기한 경과', '구성품 누락', '기타'];
const PAGE_SIZE = 20;

function buildColumns({ act, setDetail, setReject }) {
  return [
    { id: 'status', header: '상태', cell: ({ row: { original: c } }) => <StatusPill s={claimStatusLabel(c)} /> },
    { id: 'type', header: '유형', meta: { tdClass: 'font-semibold' }, cell: ({ row: { original: c } }) => CLAIM_TYPE_LABEL[c.type] },
    {
      id: 'itemNo', header: '상품주문번호',
      cell: ({ row: { original: c } }) => <Link to={`/seller/orders/${c.orderItemId}`} className="num text-sky hover:underline whitespace-nowrap">{c.itemNo}</Link>,
    },
    {
      id: 'product', header: '상품', meta: { tdClass: 'max-w-[220px] truncate' },
      cell: ({ row: { original: c } }) => <>{c.productName}<div className="text-[11.5px] text-mute">{c.optionName || '단일상품'}</div></>,
    },
    { accessorKey: 'buyerName', header: '구매자' },
    { id: 'reason', header: '사유', cell: ({ row: { original: c } }) => reasonLabel(c.reasonCode) },
    {
      id: 'requested', header: '요청일',
      cell: ({ row: { original: c } }) => {
        const pastDue = c.status === 'REQUESTED' && (Date.now() - toDate(c.requestedAt)) / 864e5 > 2;
        return <span className={`num whitespace-nowrap ${pastDue ? 'text-rust font-semibold' : ''}`}>{ymd(toDate(c.requestedAt))}{pastDue && ' (기한임박)'}</span>;
      },
    },
    { accessorKey: 'itemAmt', header: '금액', meta: { thClass: 'text-right', tdClass: 'text-right num' }, cell: ({ getValue }) => won(getValue()) },
    {
      id: 'action', header: '처리', meta: { thClass: 'text-center' },
      cell: ({ row: { original: c } }) => {
        const next = nextAction(c);
        return (
          <div className="flex gap-1 justify-center">
            <button onClick={() => setDetail(c)} className="btn btn-line btn-xs">상세</button>
            {next && <button onClick={() => act(c, next.action)} className="btn btn-ink btn-xs whitespace-nowrap">{next.label}</button>}
            {next?.rejectable && <button onClick={() => setReject(c)} className="btn btn-line btn-xs">거부</button>}
          </div>
        );
      },
    },
  ].map((col) => ({ ...col, enableSorting: false }));
}

export default function SellerClaimList() {
  const [stage, setStage] = useState('처리대기');
  const [type, setType] = useState('전체');
  const [pageIndex, setPageIndex] = useState(0);
  const [detail, setDetail] = useState(null);
  const [reject, setReject] = useState(null);
  const [rejectForm, setRejectForm] = useState({ reason: REJECT_REASONS[0], text: '' });
  const [reship, setReship] = useState(null);
  const { data: store } = useMyStoreQuery();
  const [reshipForm, setReshipForm] = useState({ courier: '', trackingNo: '' });
  const { data, isLoading, isError } = useSellerClaimsQuery({ stage: STAGES[stage], type: TYPES[type] ?? undefined, page: pageIndex, size: PAGE_SIZE });

  const approve = useApproveClaimMutation();
  const collect = useCollectClaimMutation();
  const rejectMutation = useRejectClaimMutation();
  const reshipMutation = useReshipClaimMutation();
  const busy = approve.isPending || collect.isPending || rejectMutation.isPending || reshipMutation.isPending;

  const run = async (mutation, payload, done) => {
    try {
      const c = await mutation.mutateAsync(payload);
      toast(done(c));
      setDetail(null);
      return true;
    } catch (err) {
      toast(err.response?.data?.message ?? '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  };
  // 반품 수거 완료 뒤 환불이 막히면 COLLECTED 로 응답 — 자동으로 마저 진행
  const collected = (c) => (c.type === 'EXCHANGE' ? '수거 완료 — 재배송 송장을 입력해 주세요'
    : c.status === 'COMPLETED' ? `반품 완료 — ${won(c.refundAmt)} 환불했어요` : '수거 완료 — 환불을 처리하고 있어요');
  const act = (c, action) => {
    if (action === 'approve') void run(approve, c.claimId, () => '승인했어요. 상품을 회수해 주세요');
    if (action === 'collect') void run(collect, c.claimId, collected);
    if (action === 'reship') { setReshipForm({ courier: store?.courier || COURIERS[0], trackingNo: '' }); setReship(c); }
  };
  const submitReject = async () => {
    const reason = rejectForm.text.trim() ? `${rejectForm.reason} — ${rejectForm.text.trim()}` : rejectForm.reason;
    if (await run(rejectMutation, { claimId: reject.claimId, reason }, () => '거부 사유가 구매자에게 전달되었어요')) setReject(null);
  };
  const submitReship = async () => {
    const payload = { claimId: reship.claimId, courier: reshipForm.courier, trackingNo: reshipForm.trackingNo.trim() || null };
    if (await run(reshipMutation, payload, () => '재배송 송장을 등록했어요. 배송완료되면 교환이 끝나요')) setReship(null);
  };

  const rows = data?.items.content ?? [];
  const columns = buildColumns({ act, setDetail, setReject });
  const table = useReactTable({
    data: rows, columns, getCoreRowModel: getCoreRowModel(),
    manualPagination: true, pageCount: data?.items.totalPages ?? 0,
    state: { pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (u) => setPageIndex((typeof u === 'function' ? u({ pageIndex, pageSize: PAGE_SIZE }) : u).pageIndex),
  });
  const stageCounts = { 처리대기: data?.stageCounts?.OPEN ?? 0, 처리완료: data?.stageCounts?.DONE ?? 0 };
  const typeCounts = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v ? data?.typeCounts?.[v] ?? 0
    : Object.values(data?.typeCounts ?? {}).reduce((n, c) => n + c, 0)]));
  const detailNext = detail && nextAction(detail);

  return (
    <div>
      <PageHead title="취소 · 반품 · 교환" desc="요청 접수 후 3영업일 내 처리해주세요. 반품은 수거 완료 시 결제 취소 → 재고 복원 → 구매자 포인트 환원 · 회수가 함께 진행됩니다." />
      <div className="flex flex-wrap gap-2 items-center">
        <Segments items={Object.keys(STAGES)} value={stage} onChange={(s) => { setStage(s); setPageIndex(0); }} counts={stageCounts} />
        <Segments items={Object.keys(TYPES)} value={type} onChange={(t) => { setType(t); setPageIndex(0); }} counts={typeCounts} />
      </div>
      <DataTable table={table} loading={isLoading} error={isError} empty="처리할 요청이 없습니다." className="mt-3" />

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`${CLAIM_TYPE_LABEL[detail.type]} 요청 상세`} width={560}
          footer={detailNext ? <>
            {detailNext.rejectable && <button className="btn btn-line btn-sm" onClick={() => { setReject(detail); setDetail(null); }}>거부</button>}
            <button disabled={busy} className="btn btn-ink btn-sm" onClick={() => act(detail, detailNext.action)}>{detailNext.label}</button>
          </> : <button className="btn btn-line btn-sm" onClick={() => setDetail(null)}>닫기</button>}>
          <div className="flex gap-3 pb-4 border-b border-line text-[13px]">
            <img src={detail.thumbnailUrl} alt="" className="w-14 h-16 object-cover bg-cream" />
            <div className="flex-1"><div className="font-semibold">{detail.productName}</div><div className="text-mute">{detail.optionName || '단일상품'} · {detail.quantity}개</div><div className="num text-mute">{detail.itemNo}</div></div>
            <StatusPill s={claimStatusLabel(detail)} />
          </div>
          <div className="mt-4"><KV rows={[['유형', CLAIM_TYPE_LABEL[detail.type]], ['사유', `${reasonLabel(detail.reasonCode)}${detail.reasonDetail ? ` · ${detail.reasonDetail}` : ''}`], ['요청일', ymd(toDate(detail.requestedAt))], ['구매자', detail.buyerName], ['진행', claimProgress(detail)], ['송장', detail.trackingNo ? <span className="num">{detail.courier} {detail.trackingNo}</span> : '-']]} /></div>
          {detail.type !== 'EXCHANGE' && (
            <div className="mt-4 bg-cream p-4 text-[13px] space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-2">상품 결제금액</span><span className="num">{won(detail.itemAmt)}</span></div>
              <div className="flex justify-between"><span className="text-ink-2">구매자 사용 포인트 환원</span><span className="num text-moss">+{comma(detail.restorePoint)}P</span></div>
              <div className="flex justify-between font-bold border-t border-line-2 pt-1.5"><span>결제수단 환불액 (부분 취소)</span><span className="num">{won(detail.refundAmt)}</span></div>
            </div>
          )}
          <p className="text-[12px] text-mute mt-2">{detail.type === 'EXCHANGE' ? '교환은 결제 · 재고 변동 없이 회수 확인 후 같은 옵션으로 재배송합니다.' : '환불액은 신청 때 계산된 금액(반품 배송비 차감 포함)이에요. 판매자 정산에서는 해당 상품주문이 제외됩니다.'}</p>
        </Modal>
      )}

      <Modal open={!!reject} onClose={() => setReject(null)} title="요청 거부" width={460}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setReject(null)}>취소</button><button disabled={busy} className="btn btn-ink btn-sm" onClick={() => void submitReject()}>거부하기</button></>}>
        <label className="label">거부 사유</label>
        <select value={rejectForm.reason} onChange={(e) => setRejectForm({ ...rejectForm, reason: e.target.value })} className="field mb-3">{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        <textarea rows={3} value={rejectForm.text} onChange={(e) => setRejectForm({ ...rejectForm, text: e.target.value })} maxLength={400} className="field" placeholder="구매자에게 전달할 상세 사유" />
        <p className="text-[12px] text-mute mt-2">거부 사유는 구매자의 취소 · 반품 · 교환 내역에 표시됩니다.</p>
      </Modal>

      <Modal open={!!reship} onClose={() => setReship(null)} title="교환 재배송 송장" width={460}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setReship(null)}>취소</button><button disabled={busy} className="btn btn-ink btn-sm" onClick={() => void submitReship()}>등록</button></>}>
        <label className="label">택배사</label>
        <select value={reshipForm.courier} onChange={(e) => setReshipForm({ ...reshipForm, courier: e.target.value })} className="field mb-3">{COURIERS.map((c) => <option key={c}>{c}</option>)}</select>
        <label className="label">송장번호</label>
        <input value={reshipForm.trackingNo} onChange={(e) => setReshipForm({ ...reshipForm, trackingNo: e.target.value })} className="field num" placeholder="숫자만 입력 (비우면 자동)" />
        <p className="text-[12px] text-mute mt-2">재배송이 배송완료되면(주문 관리의 배송완료 또는 자동) 교환이 끝나요.</p>
      </Modal>
    </div>
  );
}
