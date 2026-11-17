import { useEffect } from 'react';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';

// 접속 신호(11/17) — 관리자 시스템 상태의 "현재 접속자"가 바로 늘고 바로 줄게 한다. 계약 backend admin.md 9절 visitors.
// - 탭이 보이는 동안 20초마다 POST /api/presence/ping (서버는 최근 60초 안에 신호가 있는 사람을 센다)
// - 탭을 숨기거나 닫으면 POST /api/presence/leave — 페이지가 닫히는 중에도 가도록 fetch keepalive, 토큰이 있으면 회원으로
// 게이트웨이가 바로 204 로 끝내고 업무 서비스로 보내지 않는다. 실패는 무시(화면 동작과 무관)
export const PRESENCE_PING_MS = 20_000;

export function usePresence() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === 'visible') axiosInstance.post('/api/presence/ping').catch(() => {});
    };
    const leave = () => {
      const token = useAuthStore.getState().accessToken;
      fetch('/api/presence/leave', { method: 'POST', keepalive: true, headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {});
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? ping() : leave());

    ping();
    const timer = setInterval(ping, PRESENCE_PING_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', leave);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', leave);
    };
  }, []);
}
