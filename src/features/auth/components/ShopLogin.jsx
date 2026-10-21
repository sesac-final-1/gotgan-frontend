// 로그인 — 담당 이경석
/* 목업: 로그인은 화면 이동만. 실제로는 자체 폼 → user-service → Keycloak (역할 BUYER · SELLER · ADMIN) */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Checkbox } from '@/shared/components/ui';
import { cx } from '@/shared/utils/format';
import SocialLoginButtons from '@/features/auth/components/SocialLoginButtons';

export default function ShopLogin() {
  const nav = useNavigate();
  const [tab, setTab] = useState('buyer');
  const dest = { buyer: '/mypage', seller: '/seller', admin: '/admin' }[tab];
  // TODO(이경석): useLoginMutation — 지금은 선택한 역할의 첫 화면으로 이동만
  const submit = (e) => { e.preventDefault(); void nav(dest); };
  return (
    <div className="max-w-[400px] mx-auto px-4 pt-16">
      <h1 className="text-[26px] font-bold tracking-tight text-center">로그인</h1>
      <div className="mt-8 grid grid-cols-3 border border-line-2 text-[13px]">
        {[['buyer', '구매회원'], ['seller', '판매자'], ['admin', '운영자']].map(([k, l], i) => (
          <button key={k} onClick={() => setTab(k)} className={cx('h-10', i && 'border-l border-line-2', tab === k ? 'bg-ink text-white font-semibold' : 'text-ink-2')}>{l}</button>
        ))}
      </div>
      <form className="mt-6 space-y-2.5" onSubmit={submit}>
        <input className="field h-12" placeholder="이메일" />
        <input className="field h-12" type="password" placeholder="비밀번호" />
        <div className="flex justify-between items-center py-1 text-[13px]">
          <Checkbox checked label="로그인 상태 유지" />
          <span className="text-mute">아이디 · 비밀번호 찾기</span>
        </div>
        <button type="submit" className="btn btn-ink btn-lg w-full">로그인</button>
      </form>
      {tab === 'buyer' && (
        <>
          <SocialLoginButtons />
          <p className="mt-8 text-center text-[13px] text-ink-2">아직 회원이 아니신가요? <Link to="/signup" className="font-bold underline">회원가입</Link></p>
        </>
      )}
      {tab === 'seller' && <p className="mt-8 text-center text-[13px] text-ink-2">아직 입점 전이신가요? <Link to="/seller/apply" className="font-bold underline">입점 신청하기</Link></p>}
      {tab === 'admin' && <p className="mt-8 text-center text-[12px] text-mute">운영자 계정은 곳간 운영팀에서 발급합니다.</p>}
    </div>
  );
}
