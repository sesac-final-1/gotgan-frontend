// 소셜 로그인 결과 — 담당 이경석. 백엔드 콜백이 RT 쿠키를 심고 이 화면으로 보낸다 (실패면 ?error=코드)
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { refreshSession } from '@/features/auth/session';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { homePathFor, socialErrorMessage } from '@/features/auth/constants';
import { toast } from '@/shared/stores/toastStore';

export default function SocialCallback() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const started = useRef(false); // StrictMode 이중 실행 방지 — RT 로테이션이라 refresh 는 한 번만 (부팅 refresh 와는 single-flight 로 합쳐짐)

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const error = params.get('error');
    if (error) {
      toast(socialErrorMessage(error));
      void nav('/login', { replace: true });
      return;
    }
    refreshSession()
      .then(({ user }) => {
        toast(`${user.name}님, 반가워요`);
        void nav(homePathFor(user.roles), { replace: true });
      })
      .catch(() => {
        useAuthStore.getState().clearAuth();
        toast(socialErrorMessage());
        void nav('/login', { replace: true });
      });
  }, [nav, params]);

  return <p className="pt-32 text-center text-sm text-mute">로그인 중이에요…</p>;
}
