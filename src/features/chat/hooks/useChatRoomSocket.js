import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { refreshSession } from '@/features/auth/session';
import { toast } from '@/shared/stores/toastStore';
import { chatSocketUrl } from '@/features/chat/api/chatApi';
import { createChatSocket } from '@/features/chat/realtime/chatSocket';
import { frameToMessage, prependMessage } from '@/features/chat/utils/chatView';

let socket = null;

export const TYPING_SEND_MS = 3_000; // 입력하는 동안 이 간격으로 신호
export const TYPING_SHOW_MS = 5_000; // 신호를 받으면 이만큼 "입력 중…"

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
 * 새 메시지는 목록 맨 앞에 넣고, 다시 연결되면 REST 로 빈 곳을 채운다. 상대 읽음 위치(READ) · 상대 입력 중(TYPING)을 돌려준다
 */
export function useChatRoomSocket(roomId, side) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(() => getChatSocket().status);
  const [counterpartReadId, setCounterpartReadId] = useState(0);
  const [counterpartTyping, setCounterpartTyping] = useState(false);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!roomId) return undefined;
    const chat = getChatSocket();
    setCounterpartReadId(0);
    setCounterpartTyping(false);
    const offStatus = chat.onStatus((next) => {
      setStatus(next);
      if (next === 'connected') void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(roomId) });
    });
    const offError = chat.onError((e) => toast(e.code === 'CHAT_TOO_FAST' ? '메시지를 너무 빨리 보내고 있어요.' : e.message));
    const unsubscribe = chat.subscribeRoom(roomId, (frame) => {
      if (frame.type === 'MESSAGE') {
        if (frame.senderRole !== side) {
          clearTimeout(typingTimer.current);
          setCounterpartTyping(false); // 보냈으면 입력 끝
        }
        queryClient.setQueryData(queryKeys.chat.messages(roomId), (data) => prependMessage(data, frameToMessage(frame, side)));
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.roomsAll() });
      } else if (frame.type === 'READ' && frame.userRole !== side) {
        setCounterpartReadId((prev) => Math.max(prev, frame.lastMessageId));
      } else if (frame.type === 'TYPING' && frame.userRole !== side) {
        setCounterpartTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setCounterpartTyping(false), TYPING_SHOW_MS);
      } else if (frame.type === 'STATUS') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.roomsAll() });
      }
    });
    setStatus(chat.status);
    return () => {
      clearTimeout(typingTimer.current);
      unsubscribe();
      offStatus();
      offError();
    };
  }, [roomId, side, queryClient]);

  const send = useCallback((content) => {
    lastTypingSent.current = 0; // 보낸 뒤 다시 입력하면 바로 신호
    return getChatSocket().send(roomId, content);
  }, [roomId]);
  /** 입력할 때마다 불러도 TYPING_SEND_MS 에 한 번만 보낸다 */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_SEND_MS) return;
    lastTypingSent.current = now;
    getChatSocket().typing(roomId);
  }, [roomId]);
  return { status, send, notifyTyping, counterpartReadId, counterpartTyping };
}
