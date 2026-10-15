// 마이페이지 배송지 관리 — 담당 이경석. 카드형 목록(표 아님)이라 목업 그대로
import { useState } from 'react';
import { Modal, Checkbox } from '@/shared/components/ui';
import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import { useMyAddressesQuery } from '@/features/user/hooks/useMyAddressesQuery';
import { toast } from '@/shared/stores/toastStore';

export default function MyAddresses() {
  const [open, setOpen] = useState(false);
  const { data: addresses = [], isLoading } = useMyAddressesQuery();
  const save = () => {
    // TODO(이경석): useCreateAddressMutation
    setOpen(false);
    toast('배송지가 추가되었어요');
  };
  return (
    <div>
      <MyPageHead right={<button onClick={() => setOpen(true)} className="btn btn-ink btn-sm">+ 배송지 추가</button>}>배송지 관리</MyPageHead>
      {isLoading ? (
        <p className="text-mute py-10 text-center">불러오는 중…</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="border border-line p-5 flex justify-between gap-4 text-[13px]">
              <div>
                <div className="font-bold text-[14px]">{a.label} · {a.name} {a.main && <span className="text-point text-[11px] ml-1">기본배송지</span>}</div>
                <div className="text-ink-2 mt-1">{a.phone}</div><div className="text-ink-2">({a.zip}) {a.addr} {a.detail}</div>
              </div>
              <div className="flex gap-1.5 items-start"><button className="btn btn-line btn-xs">수정</button>{!a.main && <button className="btn btn-ghost btn-xs">삭제</button>}</div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="배송지 추가"
        footer={<><button className="btn btn-line btn-sm" onClick={() => setOpen(false)}>취소</button><button className="btn btn-ink btn-sm" onClick={save}>저장</button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2"><input className="field" placeholder="배송지명 (예: 집)" /><input className="field" placeholder="받는 분" /></div>
          <input className="field" placeholder="연락처" />
          <div className="flex gap-2"><input className="field" placeholder="우편번호" /><button className="btn btn-line shrink-0">주소 검색</button></div>
          <input className="field" placeholder="기본 주소" /><input className="field" placeholder="상세 주소" />
          <Checkbox checked={false} label="기본 배송지로 설정" />
        </div>
      </Modal>
    </div>
  );
}
