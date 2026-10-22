// 로그인 세션 — 담당 이경석. 재발급 결과를 authStore 에 반영하는 곳은 여기 하나 (부팅 · 401 인터셉터 · 소셜 콜백이 같이 쓴다)
import { refreshOnce } from '@/shared/api/refresh';
import { refreshToken } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';

// RT 쿠키로 재발급 — 동시에 불려도 요청은 한 번. 성공하면 { accessToken, expiresIn, user }
export function refreshSession() {
  return refreshOnce(async () => {
    const result = await refreshToken();
    useAuthStore.getState().setAuth({ accessToken: result.accessToken, user: result.user });
    return result;
  });
}

// 부팅 시 1회 — RT 쿠키가 살아 있으면 로그인 복구, 아니면(401 등) 비로그인. 어느 쪽이든 isAuthReady 가 켜진다
export function restoreSession() {
  return refreshSession().catch(() => useAuthStore.getState().clearAuth());
}
