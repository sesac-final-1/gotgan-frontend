// 마이페이지 배송지 관리 — 담당 이경석. 카드형 목록 · 등록 / 수정 / 삭제 / 기본 지정 (최대 5개)
import { useState } from 'react';
import { Modal, Checkbox } from '@/shared/components/ui';
import { PostcodeSearch } from '@/shared/components/common/PostcodeSearch';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import {
  useCreateAddressMutation, useDeleteAddressMutation, useSetDefaultAddressMutation, useUpdateAddressMutation,
} from '@/features/user/hooks/useAddressMutations';
import { addressSchema } from '@/features/user/schemas';
import { MAX_ADDRESSES } from '@/features/user/constants';
import { toast } from '@/shared/stores/toastStore';

const FALLBACK_MESSAGE = '서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요';
const serverMessage = (err) => err.response?.data?.message ?? FALLBACK_MESSAGE;
const EMPTY = { label: '', name: '', phone: '', zip: '', addr: '', detail: '', main: false };

export default function MyAddresses() {
  const { data: addresses = [], isLoading, isError } = useMyAddressesQuery();
  const [editing, setEditing] = useState(null); // null · { mode: 'create' } · { mode: 'edit', address }
  const [deleting, setDeleting] = useState(null);
  const setDefault = useSetDefaultAddressMutation();
  const full = addresses.length >= MAX_ADDRESSES;

  const handleSetDefault = (a) => setDefault.mutate(a.id, {
    onSuccess: () => toast(`${a.label}을(를) 기본 배송지로 지정했어요`),
    onError: (err) => toast(serverMessage(err)),
  });

  return (
    <div>
      <MyPageHead right={(
        <button type="button" onClick={() => setEditing({ mode: 'create' })} disabled={full} className="btn btn-ink btn-sm"
          title={full ? `배송지는 최대 ${MAX_ADDRESSES}개까지 등록할 수 있어요` : undefined}>+ 배송지 추가</button>
      )}>배송지 관리</MyPageHead>
      {full && <p className="mb-3 text-[12px] text-mute">배송지는 최대 {MAX_ADDRESSES}개까지 등록할 수 있어요. 새로 추가하려면 하나를 삭제해주세요.</p>}
      {isLoading && <p className="text-mute py-10 text-center">불러오는 중…</p>}
      {isError && <p className="text-mute py-10 text-center">배송지를 불러오지 못했어요</p>}
      {!isLoading && !isError && addresses.length === 0 && <p className="text-mute py-10 text-center">등록된 배송지가 없어요. 배송지를 추가해주세요</p>}
      <div className="space-y-3">
        {addresses.map((a) => (
          <div key={a.id} className="border border-line p-5 flex justify-between gap-4 text-[13px]">
            <div>
              <div className="font-bold text-[14px]">{a.label} · {a.name} {a.main && <span className="text-point text-[11px] ml-1">기본배송지</span>}</div>
              <div className="text-ink-2 mt-1">{a.phone}</div><div className="text-ink-2">({a.zip}) {a.addr} {a.detail}</div>
            </div>
            <div className="flex gap-1.5 items-start shrink-0">
              {!a.main && <button type="button" onClick={() => handleSetDefault(a)} disabled={setDefault.isPending} className="btn btn-line btn-xs">기본으로</button>}
              <button type="button" onClick={() => setEditing({ mode: 'edit', address: a })} className="btn btn-line btn-xs">수정</button>
              {/* 기본 배송지는 삭제 불가 (서버도 409) — 다른 배송지를 기본으로 지정한 뒤 삭제 */}
              {!a.main && <button type="button" onClick={() => setDeleting(a)} className="btn btn-ghost btn-xs">삭제</button>}
            </div>
          </div>
        ))}
      </div>
      {editing && <AddressFormModal key={editing.address?.id ?? 'new'} address={editing.address} onClose={() => setEditing(null)} />}
      {deleting && <DeleteAddressModal address={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}

// 등록 · 수정 — 같은 폼. 우편번호 · 기본 주소는 주소 검색으로만 채운다
// 등록은 연락처를 내 회원정보 휴대폰으로 미리 채운다 (수정 가능, 소셜 가입처럼 비어 있으면 빈 칸)
function AddressFormModal({ address, onClose }) {
  const editMode = !!address;
  const { data: me } = useMeQuery(); // 마이페이지 레이아웃이 이미 불러와 캐시에 있음
  const [form, setForm] = useState(() => (address
    ? { ...EMPTY, ...address, detail: address.detail ?? '' }
    : { ...EMPTY, phone: me?.phone ?? '' }));
  const [errors, setErrors] = useState({});
  const [searching, setSearching] = useState(false);
  const create = useCreateAddressMutation();
  const update = useUpdateAddressMutation();
  const pending = create.isPending || update.isPending;

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };
  const handlePostcode = ({ zip, addr }) => {
    setForm((f) => ({ ...f, zip, addr }));
    setErrors((prev) => ({ ...prev, zip: undefined, addr: undefined }));
    setSearching(false);
  };

  const handleSave = () => {
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries([...parsed.error.issues].reverse().map((i) => [i.path[0], i.message])));
      return;
    }
    const request = parsed.data;
    const callbacks = {
      onSuccess: () => {
        toast(editMode ? '배송지를 수정했어요' : '배송지를 추가했어요');
        onClose();
      },
      onError: (err) => setErrors({ form: serverMessage(err) }), // 409 ADDRESS_LIMIT_EXCEEDED 등
    };
    if (editMode) update.mutate({ id: address.id, request }, callbacks);
    else create.mutate(request, callbacks);
  };

  const err = (name) => (errors[name] ? <p className="mt-1 text-[12px] text-rust">{errors[name]}</p> : null);
  return (
    <Modal open onClose={onClose} title={editMode ? '배송지 수정' : '배송지 추가'}
      footer={<><button type="button" className="btn btn-line btn-sm" onClick={onClose}>취소</button><button type="button" className="btn btn-ink btn-sm" onClick={handleSave} disabled={pending}>{pending ? '저장 중…' : '저장'}</button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><input name="label" aria-label="배송지 이름" className="field" placeholder="배송지명 (예: 집)" value={form.label} onChange={handleChange} />{err('label')}</div>
          <div><input name="name" aria-label="받는 분" className="field" placeholder="받는 분" value={form.name} onChange={handleChange} />{err('name')}</div>
        </div>
        <div><input name="phone" type="tel" aria-label="연락처" className="field" placeholder="휴대폰 (010-0000-0000)" value={form.phone} onChange={handleChange} />{err('phone')}</div>
        <div>
          <div className="flex gap-2">
            <input aria-label="우편번호" className="field bg-cream" placeholder="우편번호" value={form.zip} readOnly />
            <button type="button" onClick={() => setSearching((s) => !s)} className="btn btn-line shrink-0">{searching ? '검색 닫기' : '주소 검색'}</button>
          </div>
          {err('zip')}
        </div>
        {searching && <PostcodeSearch onSelect={handlePostcode} />}
        <div><input aria-label="기본 주소" className="field bg-cream" placeholder="기본 주소 (주소 검색)" value={form.addr} readOnly />{!errors.zip && err('addr')}</div>
        <div><input name="detail" aria-label="상세 주소" className="field" placeholder="상세 주소 (선택)" value={form.detail} onChange={handleChange} />{err('detail')}</div>
        {!(editMode && address.main) && (
          <Checkbox checked={form.main} onChange={(checked) => setForm((f) => ({ ...f, main: checked }))} label="기본 배송지로 설정" />
        )}
        {errors.form && <p role="alert" className="text-[13px] text-rust">{errors.form}</p>}
      </div>
    </Modal>
  );
}

function DeleteAddressModal({ address, onClose }) {
  const remove = useDeleteAddressMutation();
  const [error, setError] = useState('');
  const handleDelete = () => remove.mutate(address.id, {
    onSuccess: () => {
      toast('배송지를 삭제했어요');
      onClose();
    },
    onError: (err) => setError(serverMessage(err)),
  });
  return (
    <Modal open onClose={onClose} title="배송지 삭제" width={400}
      footer={<><button type="button" className="btn btn-line btn-sm" onClick={onClose}>취소</button><button type="button" className="btn btn-ink btn-sm" onClick={handleDelete} disabled={remove.isPending}>삭제</button></>}>
      <p className="text-[14px]"><b>{address.label}</b> 배송지를 삭제할까요?</p>
      <p className="mt-1 text-[13px] text-ink-2">({address.zip}) {address.addr} {address.detail}</p>
      {error && <p role="alert" className="mt-3 text-[13px] text-rust">{error}</p>}
    </Modal>
  );
}
