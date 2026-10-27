import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { refreshSession } from '@/features/auth/session';
import { toast } from '@/shared/stores/toastStore';
import { chatSocketUrl } from '@/features/chat/api/chatApi';
import { createChatSocket } from '@/features/chat/realtime/chatSocket';
import { frameToMessage, prependMessage } from '@/features/chat/utils/chatView';

let socket = null;

/** 앱 전체에서 연결 하나 — 처음 쓸 때 만든다 (채팅 화면에 들어가지 않으면 연결하지 않음) */
export function getChatSocket() {
  socket ??= createChatSocket({
    url: chatSocketUrl(),
    getToken: () => useAuthStore.getState().accessToken,
    refreshToken: refreshSession,
  });
  return socket;
}

/** 테스트 정리용 */
export function resetChatSocket() {
  socket?.dispose();
  socket = null;
}

/**
 * 열린 방의 실시간 — 화면에 있는 동안만 구독하고 떠나면 해제(연결 정리는 chatSocket).
 * 새 메시지는 목록 맨 앞에 넣고, 다시 연결되면 REST 로 빈 곳을 채운다. 상대 읽음 위치(READ)를 돌려준다
 */
export function useChatRoomSocket(roomId, side) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(() => getChatSocket().status);
  const [counterpartReadId, setCounterpartReadId] = useState(0);

  useEffect(() => {
    if (!roomId) return undefined;
    const chat = getChatSocket();
    setCounterpartReadId(0);
    const offStatus = chat.onStatus((next) => {
      setStatus(next);
      if (next === 'connected') void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(roomId) });
    });
    const offError = chat.onError((e) => toast(e.code === 'CHAT_TOO_FAST' ? '메시지를 너무 빨리 보내고 있어요.' : e.message));
    const unsubscribe = chat.subscribeRoom(roomId, (frame) => {
      if (frame.type === 'MESSAGE') {
        queryClient.setQueryData(queryKeys.chat.messages(roomId), (data) => prependMessage(data, frameToMessage(frame, side)));
        void queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
      } else if (frame.type === 'READ' && frame.userRole !== side) {
        setCounterpartReadId((prev) => Math.max(prev, frame.lastMessageId));
      } else if (frame.type === 'STATUS') {
        void queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
      }
    });
    setStatus(chat.status);
    return () => {
      unsubscribe();
      offStatus();
      offError();
    };
  }, [roomId, side, queryClient]);

  const send = useCallback((content) => getChatSocket().send(roomId, content), [roomId]);
  return { status, send, counterpartReadId };
}
