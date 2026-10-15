// 스토어 설정 — 담당 박지연
import { useState } from 'react';
import { PageHead, StatusPill, Modal, KV, Checkbox } from '@/shared/components/ui';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { toast } from '@/shared/stores/toastStore';
import { ymd, cx } from '@/shared/utils/format';

export default function SellerStoreSettings() {
  const { data: store, isLoading } = useMyStoreQuery();
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!store) return <p className="text-mute py-10 text-center">스토어 정보를 찾을 수 없어요</p>;
  return <StoreSettingsBody key={store.id} s={store} />; // key: 스토어 데이터로 대표 색상 상태 초기화
}

function StoreSettingsBody({ s }) {
  const [color, setColor] = useState(s.color);
  const [dormant, setDormant] = useState(false);
  // TODO(박지연): useUpdateMyStoreMutation
  const save = () => toast('저장되었어요');
  // TODO(박지연): useRequestStoreDormantMutation
  const requestDormant = () => { setDormant(false); toast('휴면 전환이 신청되었어요 (관리자 확인 후 적용)'); };
  return (
    <div>
      <PageHead title="스토어 설정" right={<button onClick={save} className="btn btn-ink btn-sm">저장</button>} />
      <div className="grid xl:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">기본 정보</span><StatusPill s={s.status} /></div>
          <div className="p-5 space-y-4">
            <div className="relative h-32 bg-sand"><img src={s.cover} alt="" className="w-full h-full object-cover" /><button className="absolute right-2 bottom-2 btn btn-line btn-xs">커버 변경</button></div>
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 text-white text-2xl font-black flex items-center justify-center" style={{ background: color }}>{s.name[0]}</span>
              <div className="flex gap-1.5">{['#5b6b4a', '#2b2b2b', '#7a4b2a', '#2f5f8a', '#b4371f', '#c08a2e'].map((c) => <button key={c} onClick={() => setColor(c)} className={cx('w-7 h-7', color === c && 'ring-2 ring-offset-2 ring-ink')} style={{ background: c }} />)}</div>
            </div>
            <div><label className="label">스토어명</label><input className="field bg-cream" defaultValue={s.name} readOnly /><p className="text-[12px] text-mute mt-1">스토어명 변경은 관리자 승인이 필요합니다.</p></div>
            <div><label className="label">스토어 URL</label><input className="field bg-cream num" defaultValue={`gotgan.kr/store/${s.slug}`} readOnly /></div>
            <div><label className="label">소개</label><textarea rows={3} className="field" defaultValue={s.intro} /></div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">배송 정책 (기본값)</span></div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <div><label className="label">택배사</label><select className="field" defaultValue={s.courier}><option>CJ대한통운</option><option>롯데택배</option><option>한진택배</option><option>우체국택배</option></select></div>
              <div><label className="label">기본 배송비</label><input className="field num" defaultValue={s.shipFee} /></div>
              <div><label className="label">무료배송 기준금액</label><input className="field num" defaultValue={s.freeOver} /></div>
              <div><label className="label">반품 배송비 (편도)</label><input className="field num" defaultValue={s.shipFee} /></div>
              <div className="sm:col-span-2"><label className="label">출고 안내 문구</label><input className="field" defaultValue={s.dispatch} /></div>
              <div className="sm:col-span-2"><label className="label">반품/교환지 주소</label><input className="field" defaultValue="서울 성동구 성수일로 77 2층 오롯이 리넨 작업실" /></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">사업자 · 정산 정보</span><button className="btn btn-line btn-xs">변경 요청</button></div>
            <div className="p-5"><KV rows={[['상호', `(주)${s.name.replace(/\s/g, '')}`], ['대표자', s.owner], ['사업자번호', s.bizNo], ['정산 계좌', '기업은행 010-****-8812'], ['입점일', ymd(s.since)], ['판매자 등급', `${s.grade} (최근 3개월 매출 · 페널티 기준)`]]} /></div>
          </div>
          <div className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div><div className="font-bold text-[14px]">휴면 전환</div><p className="text-[12.5px] text-mute mt-1">스토어와 모든 상품이 쇼핑몰에서 숨겨집니다. 진행 중인 주문은 계속 처리해야 합니다.</p></div>
              <button onClick={() => setDormant(true)} className="btn btn-line btn-sm shrink-0">휴면 신청</button>
            </div>
          </div>
        </div>
      </div>
      <Modal open={dormant} onClose={() => setDormant(false)} title="휴면 전환 신청" width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setDormant(false)}>취소</button><button className="btn btn-ink btn-sm" onClick={requestDormant}>신청</button></>}>
        <p className="text-[14px]">미처리 주문 <b className="text-point">3건</b>이 있습니다. 처리 완료 후 휴면 전환됩니다.</p>
        <Checkbox className="mt-4" checked label="휴면 기간 중 정산은 '지급보류' 처리됨을 확인했습니다" />
      </Modal>
    </div>
  );
}
