// 로그아웃 — 담당 이경석. 서버 세션 종료가 실패해도(네트워크 등) 화면은 로그아웃 상태로 — 메모리 AT 를 버리고 캐시를 비운다
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { toast } from '@/shared/stores/toastStore';

export function useLogout() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    try {
      await logout();
    } catch {
      // RT 쿠키 · Keycloak 세션은 만료(14일)까지 남을 수 있음 — 화면 상태는 그대로 정리
    }
    useAuthStore.getState().clearAuth();
    queryClient.clear(); // 이전 사용자 데이터가 다음 로그인 화면에 보이지 않게
    toast('로그아웃되었어요');
    void nav('/', { replace: true });
  };
}
