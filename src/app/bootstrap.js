import { setAuthHandlers } from '@/shared/api/axiosInstance';
import { refreshAndStore, restoreSession } from '@/features/auth/session';
import { useAuthStore } from '@/features/auth/stores/authStore';

// 부팅 — axios 에 authStore 를 잇고, RT 쿠키로 로그인 상태를 1회 복구한다 (컨벤션 4-4). 화면은 기다리지 않고 바로 그린다
// (가드는 isAuthReady 가 켜질 때까지 판단을 미룬다)
export function bootstrap() {
  setAuthHandlers({
    getAccessToken: () => useAuthStore.getState().accessToken,
    refresh: refreshAndStore, // single-flight 는 인터셉터가 refreshOnce 로 — 부팅 · 소셜 콜백과 같은 대기열
    onAuthFailed: () => useAuthStore.getState().clearAuth(),
  });
  return restoreSession();
}
