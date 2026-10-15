// 회원가입 — 담당 이경석
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Checkbox } from '@/shared/components/ui';
import { toast } from '@/shared/stores/toastStore';

export default function ShopSignup() {
  const nav = useNavigate();
  const [all, setAll] = useState(false);
  // TODO(이경석): useSignupMutation
  const submit = (e) => { e.preventDefault(); toast('가입을 환영해요! 로그인해주세요'); nav('/login'); };
  return (
    <div className="max-w-[440px] mx-auto px-4 pt-16">
      <h1 className="text-[26px] font-bold tracking-tight">회원가입</h1>
      <p className="mt-1 text-sm text-mute">결제할 때마다 실결제금액의 5%가 포인트로 적립돼요.</p>
      <form className="mt-8 space-y-4" onSubmit={submit}>
        <div><label className="label">이메일</label><div className="flex gap-2"><input className="field" placeholder="example@email.com" /><button type="button" className="btn btn-line shrink-0">중복확인</button></div></div>
        <div><label className="label">비밀번호</label><input type="password" className="field" placeholder="영문, 숫자, 특수문자 포함 8자 이상" /></div>
        <div><label className="label">비밀번호 확인</label><input type="password" className="field" /></div>
        <div><label className="label">이름</label><input className="field" /></div>
        <div><label className="label">휴대폰 번호</label><div className="flex gap-2"><input className="field" placeholder="010-0000-0000" /><button type="button" onClick={() => toast('인증번호를 보냈어요 (목업)')} className="btn btn-line shrink-0">인증요청</button></div></div>
        <div className="border border-line p-4 space-y-2.5 text-[13px]">
          <Checkbox checked={all} onChange={setAll} label={<b>전체 동의</b>} />
          <div className="h-px bg-line" />
          {['(필수) 만 14세 이상입니다', '(필수) 이용약관 동의', '(필수) 개인정보 수집·이용 동의', '(선택) 마케팅 정보 수신 동의'].map((t) => <Checkbox key={t} checked={all} onChange={() => {}} label={t} />)}
        </div>
        <button className="btn btn-ink btn-lg w-full">가입하기</button>
      </form>
    </div>
  );
}
