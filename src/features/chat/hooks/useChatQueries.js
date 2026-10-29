import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuthStore } from '@/features/auth/stores/authStore';
import {
  changeChatStatus, fetchChatMessages, fetchChatRooms, fetchChatUnreadCount, openChatRoom, PAGE_SIZE, readChatRoom,
} from '@/features/chat/api/chatApi';

// 채팅 조회 · 변경 훅 — 담당 구지훈. 실시간 반영은 useChatRoomSocket, 다른 방 소식은 알림 SSE(CHAT_MESSAGE)가 chat 키를 무효화

export function useChatRoomsQuery(filter) {
  const loggedIn = useAuthStore((s) => !!s.user);
  return useQuery({ queryKey: queryKeys.chat.rooms(filter), queryFn: () => fetchChatRooms(filter), enabled: loggedIn });
}

export function useChatUnreadCountQuery() {
  const loggedIn = useAuthStore((s) => !!s.user);
  return useQuery({ queryKey: queryKeys.chat.unread(), queryFn: fetchChatUnreadCount, enabled: loggedIn });
}

/** 메시지 — 최신 페이지부터, 더 보기는 가장 오래된 메시지 이전 */
export function useChatMessagesQuery(roomId) {
  return useInfiniteQuery({
    queryKey: queryKeys.chat.messages(roomId),
    queryFn: ({ pageParam }) => fetchChatMessages(roomId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.length === PAGE_SIZE ? last[last.length - 1].messageId : undefined),
    enabled: !!roomId,
  });
}

export function useOpenChatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: openChatRoom,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chat.all }),
  });
}

/** 읽음 — 목록 · 배지 숫자만 새로 (메시지는 그대로) */
export function useReadChatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, lastMessageId }) => readChatRoom(roomId, lastMessageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.roomsAll() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.unread() });
    },
  });
}

export function useChangeChatStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, status }) => changeChatStatus(roomId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.chat.roomsAll() }),
  });
}
