// 로그인 — 담당 이경석. 자체 폼 → user-service → Keycloak (Keycloak 로그인 화면으로 보내지 않음, 컨벤션 4-4)
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { cx } from '@/shared/utils/format';
import { toast } from '@/shared/stores/toastStore';
import SocialLoginButtons from '@/features/auth/components/SocialLoginButtons';
import { login, logout } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { loginSchema } from '@/features/auth/schemas';
import { LOGIN_FALLBACK_MESSAGE, LOGIN_TABS, roleMismatchMessage } from '@/features/auth/constants';

export default function ShopLogin() {
  const nav = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(LOGIN_TABS[0]);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handleTabClick = (next) => { setTab(next); setError(''); };

  // 인증 액션은 API 직접 호출 (컨벤션 4-6 예외)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { accessToken, user } = await login(parsed.data);
      if (!user.roles.includes(tab.role)) {
        // 고른 탭의 역할이 없는 계정 — 방금 만든 세션을 끝내고 안내만 (로그인 상태로 두지 않음)
        await logout().catch(() => {});
        setError(roleMismatchMessage(tab));
        return;
      }
      useAuthStore.getState().setAuth({ accessToken, user });
      toast(`${user.name}님, 반가워요`);
      void nav(location.state?.from ?? tab.home, { replace: true }); // 가드가 보낸 경우 원래 가려던 화면으로
    } catch (err) {
      setError(err.response?.data?.message ?? LOGIN_FALLBACK_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[400px] mx-auto px-4 pt-16">
      <h1 className="text-[26px] font-bold tracking-tight text-center">로그인</h1>
      <div className="mt-8 grid grid-cols-3 border border-line-2 text-[13px]" role="tablist">
        {LOGIN_TABS.map((t, i) => (
          <button key={t.role} type="button" role="tab" aria-selected={tab.role === t.role} onClick={() => handleTabClick(t)}
            className={cx('h-10', i && 'border-l border-line-2', tab.role === t.role ? 'bg-ink text-white font-semibold' : 'text-ink-2')}>{t.label}</button>
        ))}
      </div>
      <form className="mt-6 space-y-2.5" onSubmit={handleSubmit} noValidate>
        <input className="field h-12" name="email" type="email" autoComplete="username" placeholder="이메일" aria-label="이메일"
          value={form.email} onChange={handleChange} />
        <input className="field h-12" name="password" type="password" autoComplete="current-password" placeholder="비밀번호" aria-label="비밀번호"
          value={form.password} onChange={handleChange} />
        {error && <p role="alert" className="pt-1 text-[13px] text-rust">{error}</p>}
        <div className="pt-1.5">
          <button type="submit" className="btn btn-ink btn-lg w-full" disabled={submitting}>{submitting ? '로그인 중…' : '로그인'}</button>
        </div>
      </form>
      {tab.role === 'BUYER' && (
        <>
          <SocialLoginButtons />
          <p className="mt-8 text-center text-[13px] text-ink-2">아직 회원이 아니신가요? <Link to="/signup" className="font-bold underline">회원가입</Link></p>
        </>
      )}
      {tab.role === 'SELLER' && <p className="mt-8 text-center text-[13px] text-ink-2">아직 입점 전이신가요? <Link to="/seller/apply" className="font-bold underline">입점 신청하기</Link></p>}
      {tab.role === 'ADMIN' && <p className="mt-8 text-center text-[12px] text-mute">운영자 계정은 곳간 운영팀에서 발급합니다.</p>}
    </div>
  );
}
