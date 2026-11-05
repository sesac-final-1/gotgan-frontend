// 스토어 설정 — 담당 박지연. 계약 backend docs/api/store.md 12 · 13절
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { PageHead, StatusPill, KV, Modal } from '@/shared/components/ui';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useUpdateMyStoreMutation, useCloseMyStoreMutation } from '@/features/store/hooks/useMyStoreMutations';
import { storeUrlPrefix } from '@/features/store/constants';
import { uploadStoreImage, STORE_IMAGE_TYPES, STORE_IMAGE_MAX_BYTES } from '@/features/store/api/storeApi';
import { initialSettings, validateSettings, buildSettingsRequest, paletteWith, couriersWith, isAllFree } from '@/features/store/storeSettings';
import { toast } from '@/shared/stores/toastStore';
import { ymd, ymdhm, cx } from '@/shared/utils/format';

const digits = (v) => v.replace(/\D/g, '');
const errorMessage = (err, fallback) => err?.response?.data?.message ?? err?.message ?? fallback;

export default function SellerStoreSettings() {
  const { data: store, isLoading } = useMyStoreQuery();
  if (isLoading) return <p className="text-mute py-10 text-center">불러오는 중…</p>;
  if (!store) return <p className="text-mute py-10 text-center">스토어 정보를 찾을 수 없어요</p>;
  return <StoreSettingsBody key={store.id} s={store} />; // key: 다른 스토어로 바뀌면 폼 초기화
}

function StoreSettingsBody({ s }) {
  const [f, setF] = useState(() => initialSettings(s));
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [closedAt, setClosedAt] = useState(null);
  const fileRef = useRef(null);
  const update = useUpdateMyStoreMutation();
  const close = useCloseMyStoreMutation();
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));
  const closed = s.status === '폐점';

  const save = () => {
    const problem = validateSettings(f);
    if (problem) return toast(problem);
    update.mutate(buildSettingsRequest(f), {
      onSuccess: () => toast('저장되었어요'),
      onError: (err) => toast(errorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')),
    });
  };

  // 파일 선택 → 화면 검사(형식 · 10MB) → 발급 · S3 PUT → 키를 폼에(저장을 눌러야 반영). 미리보기는 브라우저 메모리 주소
  const pickCover = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!STORE_IMAGE_TYPES.includes(file.type)) return toast('JPG · PNG · WEBP 이미지만 올릴 수 있어요');
    if (file.size > STORE_IMAGE_MAX_BYTES) return toast('이미지는 10MB 이하만 올릴 수 있어요');
    setUploading(true);
    try {
      set({ imageKey: await uploadStoreImage(file), cover: URL.createObjectURL(file) });
    } catch (err) {
      toast(errorMessage(err, '이미지를 올리지 못했어요'));
    } finally {
      setUploading(false);
    }
  };

  const doClose = () => close.mutate(undefined, {
    onSuccess: (r) => { setClosedAt(r.closedAt); toast('스토어를 폐점했어요'); },
    onError: (err) => toast(errorMessage(err, '폐점하지 못했어요. 잠시 후 다시 시도해 주세요.')),
    onSettled: () => setAsking(false),
  });

  return (
    <div>
      <PageHead title="스토어 설정" right={<button disabled={closed || update.isPending || uploading} onClick={save} className="btn btn-ink btn-sm">{update.isPending ? '저장 중…' : '저장'}</button>} />
      {s.status === '정지' && <div className="panel p-4 mb-4 text-[13px] text-rust">관리자가 스토어를 정지했어요{s.statusReason && ` — 사유: ${s.statusReason}`}. 쇼핑몰에 상품이 보이지 않아요.</div>}
      <div className="grid xl:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">기본 정보</span><StatusPill s={s.status} /></div>
          <div className="p-5 space-y-4">
            <div className="relative h-32" style={{ background: f.color }}>
              {f.cover && <img src={f.cover} alt="" className="w-full h-full object-cover" />}
              <div className="absolute right-2 bottom-2 flex gap-1">
                {f.cover && <button disabled={closed} onClick={() => set({ imageKey: null, cover: null })} className="btn btn-line btn-xs bg-white">이미지 삭제</button>}
                <button disabled={closed || uploading} onClick={() => fileRef.current?.click()} className="btn btn-line btn-xs bg-white">{uploading ? '올리는 중…' : '커버 변경'}</button>
              </div>
              <input ref={fileRef} type="file" accept={STORE_IMAGE_TYPES.join(',')} hidden onChange={pickCover} />
            </div>
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 text-white text-2xl font-black flex items-center justify-center" style={{ background: f.color }}>{s.name[0]}</span>
              <div className="flex gap-1.5">{paletteWith(s.color).map((c) => <button key={c} aria-label={`대표 색 ${c}`} onClick={() => set({ color: c })} className={cx('w-7 h-7', f.color === c && 'ring-2 ring-offset-2 ring-ink')} style={{ background: c }} />)}</div>
            </div>
            <div><label className="label">스토어명</label><input className="field bg-cream" value={s.name} readOnly /><p className="text-[12px] text-mute mt-1">스토어명 변경은 관리자 승인이 필요합니다.</p></div>
            <div><label className="label">스토어 URL</label><input className="field bg-cream num" value={`${storeUrlPrefix()}${s.slug}`} readOnly /></div>
            <div><label className="label">고객센터 전화</label><input className="field num" value={f.csPhone} onChange={(e) => set({ csPhone: e.target.value })} placeholder="010-0000-0000" /></div>
            <div><label className="label">소개</label><textarea rows={3} maxLength={5000} className="field" value={f.intro} onChange={(e) => set({ intro: e.target.value })} /></div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">배송 정책 (기본값)</span></div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <div><label className="label">택배사</label>
                <select className="field" value={f.courier} onChange={(e) => set({ courier: e.target.value })}>
                  <option value="">선택 안 함</option>
                  {couriersWith(s.courier).map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">기본 배송비</label><input className="field num" value={f.shippingFee} onChange={(e) => set({ shippingFee: digits(e.target.value) })} /><p className="text-[12px] text-mute mt-1">0원이면 모든 주문 무료배송이에요.</p></div>
              <div><label className="label">무료배송 기준금액</label><input className="field num" disabled={isAllFree(f)} value={isAllFree(f) ? '' : f.freeOver} onChange={(e) => set({ freeOver: digits(e.target.value) })} placeholder={isAllFree(f) ? '모든 주문 무료배송' : '비우면 무료배송 없음'} /></div>
              <div className="text-[12px] text-mute sm:pt-6">반품 배송비는 기본 배송비 × 2(왕복)로 계산돼요.</div>
              <div className="sm:col-span-2"><label className="label">출고 안내 문구</label><input className="field" maxLength={100} value={f.dispatchNote} onChange={(e) => set({ dispatchNote: e.target.value })} /></div>
              <p className="sm:col-span-2 text-[12px] text-mute">바꾼 배송비는 새 주문부터 적용돼요. 이미 들어온 주문은 그대로예요.</p>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">사업자 정보</span></div>
            <div className="p-5"><KV rows={[['대표자', s.owner], ['사업자번호', s.bizNo], ['입점일', s.since ? ymd(s.since) : '-'], ['판매자 등급', s.grade]]} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">스토어 폐점</span></div>
            <div className="p-5 text-[13px] space-y-3">
              {closed || closedAt ? (
                <p>폐점된 스토어예요{closedAt && ` (${ymdhm(closedAt)})`}. 판매자 회원 탈퇴는 <Link to="/mypage/profile" className="underline">마이페이지 회원정보</Link>에서 할 수 있어요.</p>
              ) : (
                <>
                  <p className="text-ink-2">진행 중인 주문이 없고 정산이 모두 지급된 뒤에 폐점할 수 있어요. <b>폐점하면 되돌릴 수 없고 다시 입점할 수 없어요.</b></p>
                  <button disabled={close.isPending} onClick={() => setAsking(true)} className="btn btn-line btn-sm text-rust">스토어 폐점</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={asking} onClose={() => setAsking(false)} title="스토어 폐점" width={440}
        footer={<><button className="btn btn-line btn-sm" onClick={() => setAsking(false)}>취소</button><button disabled={close.isPending} className="btn btn-sm bg-rust text-white border-rust" onClick={doClose}>폐점</button></>}>
        <p className="text-[14px]"><b>{s.name}</b>을(를) 폐점할까요?</p>
        <ul className="text-[13px] text-mute mt-2 list-disc pl-5 space-y-1">
          <li>되돌릴 수 없고, 같은 계정으로 다시 입점할 수 없어요.</li>
          <li>상품이 쇼핑몰에서 바로 숨겨져요.</li>
          <li>판매자 센터는 다음 로그인부터 쓸 수 없어요.</li>
        </ul>
      </Modal>
    </div>
  );
}
