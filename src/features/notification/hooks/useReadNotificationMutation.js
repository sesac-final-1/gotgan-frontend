import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { readAllNotifications, readNotification } from '@/features/notification/api/notificationApi';

// 읽음 — 담당 구지훈. mutate(id) = 하나, mutate(undefined) = 모두. 끝나면 목록 · 숫자를 다시 불러온다
export function useReadNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => (id ? readNotification(id) : readAllNotifications()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notification.all }),
  });
}
