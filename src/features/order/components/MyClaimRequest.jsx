// 마이페이지 클레임 신청 (취소 · 반품 · 교환) — 담당 이경석
import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { Upload } from 'lucide-react';
import { StatusPill } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useProductsQuery } from '@/features/product/hooks/useProductsQuery';
import { useStoresQuery } from '@/features/store/hooks/useStoresQuery';
import MyRefundBox, { SELLER_FAULT } from '@/features/order/components/MyRefundBox';
import { toast } from '@/shared/stores/toastStore';
import { toMap } from '@/shared/utils/collection';
import { cx, won } from '@/shared/utils/format';

const CLAIM_ALLOWED = { 결제완료: ['취소'], 배송준비: ['취소'], 배송중: [], 배송완료: ['반품', '교환'] };
const REASONS = {
  취소: ['단순 변심', '다른 상품 잘못 주문', '배송 지연', '판매자 요청'],
  반품: ['단순 변심', '사이즈/색상 안 맞음', '상품 불량/파손', '오배송', '상품정보와 다름'],
  교환: ['사이즈/색상 안 맞음', '상품 불량/파손', '오배송', '상품정보와 다름'],
};

export default function MyClaimRequest() {
  const { lineId } = useParams();
  const { data: orders = [], isLoading } = useMyOrdersQuery();
  const { data: products = [], isLoading: productsLoading } = useProductsQuery();
  const { data: stores = [] } = useStoresQuery();
  const productById = useMemo(() => toMap(products), [products]);
  const storeById = useMemo(() => toMap(stores), [stores]);
  if (isLoading || productsLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  const o = orders.find((x) => x.items.some((l) => l.lineId === lineId));
  const l = o?.items.find((x) => x.lineId === lineId);
  const p = l && productById[l.productId];
  if (!p) return <p className="text-mute py-10 text-center">상품주문을 찾을 수 없어요</p>;
  return <RequestBody key={l.lineId} o={o} l={l} p={p} store={storeById[p.storeId]} />; // key: 다른 상품주문으로 이동하면 유형 · 사유 초기화
}

function RequestBody({ o, l, p, store }) {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const allowed = CLAIM_ALLOWED[l.status] || [];
  const types = allowed.length ? allowed : ['취소', '반품', '교환'];
  const [type, setType] = useState(types.includes(sp.get('type')) ? sp.get('type') : types[0]);
  const [reason, setReason] = useState('');
  const sellerFault = SELLER_FAULT.includes(reason);
  const submit = () => {
    // TODO(이경석): useRequestClaimMutation
    toast(`${type} 신청이 접수되었어요`);
    void nav('/mypage/claims');
  };
  return (
    <div>
      <MyPageHead>취소 · 반품 · 교환 신청</MyPageHead>
      <div className="flex gap-4 border border-line p-4 text-[13px]">
        <img src={p.images[0]} alt="" className="w-16 h-20 object-cover" />
        <div className="flex-1"><div className="text-mute">{store?.name}</div><div className="font-medium text-[14px]">{p.name}</div><div className="text-mute">{l.option || '단일상품'} · {l.qty}개 · {won(l.unitPrice * l.qty)}</div></div>
        <div><StatusPill s={l.status} /></div>
      </div>
      <div className="mt-6 space-y-5">
        <div>
          <label className="label">신청 유형</label>
          <div className="grid grid-cols-3 gap-2">
            {['취소', '반품', '교환'].map((t) => {
              const on = types.includes(t);
              return (
                <button key={t} disabled={!on} onClick={() => { setType(t); setReason(''); }}
                  className={cx('h-11 border text-[14px]', type === t ? 'border-ink border-2 font-semibold' : 'border-line-2', !on && 'text-line-2 bg-cream cursor-not-allowed')}>{t}</button>
              );
            })}
          </div>
          <p className="text-[12px] text-mute mt-1.5">결제완료 · 배송준비: 취소 / 배송완료 후 7일 이내: 반품 · 교환 (구매확정 후에는 신청할 수 없어요)</p>
        </div>
        <div>
          <label className="label">{type} 사유</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {REASONS[type].map((x) => (
              <button key={x} onClick={() => setReason(x)} className={cx('h-11 border text-left px-3 text-[14px]', reason === x ? 'border-ink border-2 font-semibold' : 'border-line-2')}>{x}</button>
            ))}
          </div>
        </div>
        {type === '교환' && <div><label className="label">교환 옵션</label><select className="field"><option>{l.option} → 다른 옵션 선택</option>{p.options.flatMap((op) => op.values).map((v) => <option key={v}>{v}</option>)}</select></div>}
        <div><label className="label">상세 사유</label><textarea rows={4} className="field" placeholder="판매자에게 전달할 내용을 적어주세요" /></div>
        {type !== '취소' && (
          <div>
            <label className="label">사진 첨부 {sellerFault && <span className="text-point">(필수)</span>}</label>
            <button className="w-20 h-20 border border-dashed border-line-2 text-mute flex flex-col items-center justify-center gap-1 text-[11px]"><Upload size={18} />추가</button>
          </div>
        )}
        {type !== '취소' && (
          <div><label className="label">회수 방법</label>
            <div className="grid grid-cols-2 gap-2"><button className="h-11 border-2 border-ink text-sm font-semibold">판매자 지정 택배 회수</button><button className="h-11 border border-line-2 text-sm">직접 발송</button></div>
          </div>
        )}
        <MyRefundBox order={o} line={l} type={type} reason={reason} store={store} />
        <p className="text-[12px] text-mute -mt-3">{type === '취소' ? '결제완료 상태는 즉시, 배송준비 상태는 판매자 승인 후 환불됩니다.' : type === '반품' ? '판매자가 회수 상품을 확인한 후 환불됩니다. (영업일 1~3일)' : '교환은 결제 · 재고 변동 없이 회수 확인 후 재배송됩니다.'}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => nav(-1)} className="btn btn-line">이전으로</button>
          <button disabled={!reason} onClick={submit} className="btn btn-ink px-8">{type} 신청하기</button>
        </div>
      </div>
    </div>
  );
}
