import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { fetchUnreadCount } from '@/features/notification/api/notificationApi';

// 안 읽은 알림 수 (헤더 벨 숫자) — 담당 구지훈. 실시간 연결이 끊겨도 1분마다 다시 확인
export function useUnreadCountQuery() {
  const loggedIn = useAuthStore((s) => !!s.user);
  return useQuery({
    queryKey: queryKeys.notification.unread(),
    queryFn: () => fetchUnreadCount(),
    enabled: loggedIn,
    refetchInterval: 60_000,
  });
}
