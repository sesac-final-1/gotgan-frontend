import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { fetchNotifications } from '@/features/notification/api/notificationApi';

// 알림 목록 (최신 20개) — 담당 구지훈. 로그인했고 벨을 열었을 때만
export function useNotificationsQuery(enabled) {
  const loggedIn = useAuthStore((s) => !!s.user);
  return useQuery({
    queryKey: queryKeys.notification.list(),
    queryFn: () => fetchNotifications(),
    enabled: loggedIn && enabled,
  });
}
