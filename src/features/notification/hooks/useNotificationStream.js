import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { toast } from '@/shared/stores/toastStore';
import { NOTIFICATION_STREAM_URL } from '@/features/notification/api/notificationApi';

/**
 * 실시간 알림 (SSE, 담당 구지훈) — 새 알림이 오면 토스트 + 목록 · 숫자 다시 불러오기. 탭을 가리면 끊고 다시 보이면 연결(라이브러리 기본).
 * 토큰이 바뀌면(재발급 · 로그아웃) 다시 연결하거나 끊는다. 401 이면 다음 토큰까지 연결하지 않는다
 */
export function useNotificationStream() {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!token) return undefined;
    const ctrl = new AbortController();
    void fetchEventSource(NOTIFICATION_STREAM_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
      onopen: async (res) => {
        if (!res.ok) throw new Error(`알림 연결 실패 ${res.status}`); // onerror 로 가서 멈춤
      },
      onmessage: (ev) => {
        if (ev.event !== 'notification') return;
        const n = JSON.parse(ev.data);
        toast(n.title);
        void queryClient.invalidateQueries({ queryKey: queryKeys.notification.all });
      },
      onerror: (err) => {
        if (/알림 연결 실패 4\d\d/.test(err?.message)) throw err; // 인증 · 권한 오류는 재시도하지 않음
        return 5_000; // 네트워크 · 서버 오류는 5초 뒤 다시
      },
    }).catch(() => {}); // 멈춘 연결 — 토큰이 바뀌면 이 효과가 다시 연결
    return () => ctrl.abort();
  }, [token, queryClient]);
}
