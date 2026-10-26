// 마이페이지 클레임 신청 (취소 · 반품 · 교환) — 담당 이경석. lineId = 상품주문번호(itemNo)
// 상품주문은 주문 상세(GET /api/orders/{orderNo}), 환불 예정액은 claims/preview, 신청은 POST claims
import { useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router';
import { Upload } from 'lucide-react';
import { StatusPill } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyOrderQuery } from '@/features/order/hooks/useMyOrderQuery';
import { useClaimPreviewQuery, useRequestClaimMutation } from '@/features/order/hooks/useClaimMutations';
import { CLAIM_REASONS, CLAIM_TYPE_LABEL } from '@/features/order/constants';
import { claimDoneMessage, claimTypesOf, isSellerFault, lineStatusLabel, orderNoOf } from '@/features/order/utils/orderView';
import { toast } from '@/shared/stores/toastStore';
import { cx, won, comma } from '@/shared/utils/format';

const TYPES = ['CANCEL', 'RETURN', 'EXCHANGE'];

export default function MyClaimRequest() {
  const { lineId } = useParams();
  const { data: o, isLoading, isError } = useMyOrderQuery(orderNoOf(lineId));
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  const l = o?.items.find((x) => x.itemNo === lineId);
  if (isError || !l) return <p className="text-mute py-10 text-center">상품주문을 찾을 수 없어요</p>;
  return <RequestBody key={l.itemNo} o={o} l={l} />; // key: 다른 상품주문으로 이동하면 유형 · 사유 초기화
}

// 환불 예정액 — 서버 계산 (취소: 스토어 마지막 상품주문이면 배송비 환불, 반품: 구매자 사유면 왕복 배송비 차감, 교환: 금액 0)
function PreviewBox({ type, reasonCode, preview }) {
  const row = (k, v, cls = '') => <div className={cx('flex justify-between', cls)}><span className="text-ink-2">{k}</span><span className="num">{v}</span></div>;
  if (!reasonCode) return <div className="bg-cream p-5 text-[13px] text-mute">사유를 고르면 환불 예정 금액을 알려 드려요.</div>;
  if (preview.isError) return <div className="bg-cream p-5 text-[13px] text-rust">{preview.error.response?.data?.message ?? '환불 예정 금액을 불러오지 못했어요.'}</div>;
  const p = preview.data;
  if (!p) return <div className="bg-cream p-5 text-[13px] text-mute">계산 중…</div>;
  return (
    <div className="bg-cream p-5 text-[14px] space-y-2">
      {row('상품 금액', won(p.itemAmt))}
      {type === 'EXCHANGE'
        ? row('교환 배송비', '판매자 부담 · 같은 옵션으로 다시 보내 드려요')
        : <>
          {type === 'CANCEL'
            ? row('배송비 환불', p.shippingFee ? `+${won(p.shippingFee)}` : '없음 (같은 스토어 상품이 남아 있어요)')
            : row('반품 배송비 차감', p.shippingFee ? `−${won(Math.abs(p.shippingFee))}` : '판매자 부담')}
          {row('사용 포인트 환원', p.restorePoint ? `+${comma(p.restorePoint)}P` : '0P', 'text-moss')}
          {row('적립 포인트 회수', p.reclaimPoint ? `−${comma(p.reclaimPoint)}P` : '0P', 'text-rust')}
          <div className="flex justify-between font-bold border-t border-line-2 pt-2"><span>결제수단 환불 예정 금액</span><span className="num">{won(p.refundAmt)}</span></div>
        </>}
    </div>
  );
}

function RequestBody({ o, l }) {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const types = o.status === 'PAID' ? claimTypesOf(l.status) : [];
  const [type, setType] = useState(types.includes(sp.get('type')) ? sp.get('type') : types[0]);
  const [reasonCode, setReasonCode] = useState('');
  const [detail, setDetail] = useState('');
  const preview = useClaimPreviewQuery(o.orderNo, { orderItemId: l.orderItemId, type, reasonCode });
  const claim = useRequestClaimMutation();
  const label = CLAIM_TYPE_LABEL[type];
  const submit = async () => {
    try {
      const r = await claim.mutateAsync({ orderNo: o.orderNo, request: { orderItemId: l.orderItemId, type, reasonCode, reasonDetail: detail.trim() || null } });
      toast(claimDoneMessage(r));
      void nav('/mypage/orders');
    } catch (err) {
      toast(err.response?.data?.message ?? '신청하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  return (
    <div>
      <MyPageHead>취소 · 반품 · 교환 신청</MyPageHead>
      <div className="flex gap-4 border border-line p-4 text-[13px]">
        <img src={l.thumbnailUrl} alt="" className="w-16 h-20 object-cover bg-cream" />
        <div className="flex-1"><div className="text-mute">{l.storeName}</div><div className="font-medium text-[14px]">{l.productName}</div><div className="text-mute">{l.optionName || '단일상품'} · {l.quantity}개 · {won(l.itemAmt)}</div></div>
        <div><StatusPill s={lineStatusLabel(o, l)} /></div>
      </div>
      {!types.length ? (
        <div className="mt-6 text-center text-[14px] text-ink-2">
          <p>지금은 취소 · 반품 · 교환을 신청할 수 없는 상품이에요.</p>
          <p className="text-[12px] text-mute mt-1">결제완료: 취소 / 배송완료 후 7일 이내: 반품 · 교환 (배송준비 중 취소는 고객센터로 문의해 주세요)</p>
          <Link to="/mypage/orders" className="btn btn-line mt-5">주문 내역으로</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div>
            <label className="label">신청 유형</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => {
                const on = types.includes(t);
                return (
                  <button key={t} disabled={!on} onClick={() => { setType(t); setReasonCode(''); }}
                    className={cx('h-11 border text-[14px]', type === t ? 'border-ink border-2 font-semibold' : 'border-line-2', !on && 'text-line-2 bg-cream cursor-not-allowed')}>{CLAIM_TYPE_LABEL[t]}</button>
                );
              })}
            </div>
            <p className="text-[12px] text-mute mt-1.5">결제완료: 취소 / 배송완료 후 7일 이내: 반품 · 교환 (구매확정 후에는 신청할 수 없어요)</p>
          </div>
          <div>
            <label className="label">{label} 사유</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {CLAIM_REASONS.filter((r) => r.types.includes(type)).map((r) => (
                <button key={r.code} onClick={() => setReasonCode(r.code)} className={cx('h-11 border text-left px-3 text-[14px]', reasonCode === r.code ? 'border-ink border-2 font-semibold' : 'border-line-2')}>{r.label}</button>
              ))}
            </div>
          </div>
          <div><label className="label">상세 사유</label><textarea rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} className="field" placeholder="판매자에게 전달할 내용을 적어주세요" /></div>
          {type !== 'CANCEL' && (
            <div>
              <label className="label">사진 첨부 {isSellerFault(reasonCode) && <span className="text-point">(필수)</span>}</label>
              <button className="w-20 h-20 border border-dashed border-line-2 text-mute flex flex-col items-center justify-center gap-1 text-[11px]"><Upload size={18} />추가</button>
            </div>
          )}
          {type !== 'CANCEL' && (
            <div><label className="label">회수 방법</label>
              <div className="grid grid-cols-2 gap-2"><button className="h-11 border-2 border-ink text-sm font-semibold">판매자 지정 택배 회수</button><button className="h-11 border border-line-2 text-sm">직접 발송</button></div>
            </div>
          )}
          <PreviewBox type={type} reasonCode={reasonCode} preview={preview} />
          <p className="text-[12px] text-mute -mt-3">{type === 'CANCEL' ? '결제완료 상태는 판매자 확인 없이 바로 취소되고 결제수단으로 환불돼요.' : type === 'RETURN' ? '판매자가 회수 상품을 확인한 후 환불됩니다. (영업일 1~3일)' : '교환은 결제 · 재고 변동 없이 회수 확인 후 같은 옵션으로 재배송됩니다.'}</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => nav(-1)} className="btn btn-line">이전으로</button>
            <button disabled={!reasonCode || preview.isError || claim.isPending} onClick={() => void submit()} className="btn btn-ink px-8">{claim.isPending ? '신청 중…' : `${label} 신청하기`}</button>
          </div>
        </div>
      )}
    </div>
  );
}
