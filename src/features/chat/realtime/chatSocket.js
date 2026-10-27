import { Client } from '@stomp/stompjs';

/**
 * 채팅 실시간 연결 (STOMP, 담당 구지훈 · chat.md 6 · 6-1절) — 앱 전체에서 연결 하나를 같이 쓴다.
 * 연결은 항상 열려 있어 서버 자원을 쓰므로 "필요할 때만 열고, 안 쓰면 바로 닫는다":
 * - 채팅 화면이 방을 구독할 때만 연결. 마지막 구독이 풀리면 RELEASE_GRACE_MS 뒤 끊음(채팅 화면끼리 이동할 때 다시 연결하지 않게)
 * - 페이지를 떠나면(pagehide) 바로 끊고, 뒤로 가기 캐시로 돌아오면(pageshow) 다시 연결
 * - 탭이 가려지면 연결은 두고 방 구독만 해제 — 서버는 "보고 있지 않음"으로 알림을 보낸다. 다시 보이면 재구독하고 'connected' 를 다시 알려
 *   화면이 REST 로 빈 곳을 채운다 (잦은 탭 전환마다 재연결 비용을 들이지 않게 — 10/27 결정)
 * - 끊기면 1초부터 두 배씩 최대 30초 + 무작위 지연으로 재연결 (서버 재시작 때 한꺼번에 몰리지 않게)
 * - 토큰 만료로 닫히면(4401 · UNAUTHORIZED) 토큰을 새로 받아 재연결, 연결 수 초과(4429) · 차단(USER_BLOCKED)이면 재연결하지 않음
 * - 하트비트 10초 — 서버도 같은 값으로 끊긴 연결을 정리한다
 */
export const RELEASE_GRACE_MS = 3_000;
export const HEARTBEAT_MS = 10_000;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const ERRORS_DESTINATION = '/user/queue/errors';

/** 재연결 지연 — attempt 0 이면 1초 근처, 이후 두 배씩 최대 30초. 절반~전부 사이 무작위 */
export const reconnectDelay = (attempt, random = Math.random) =>
  Math.round(Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt) * (0.5 + random() * 0.5));

export function createChatSocket({ url, getToken, refreshToken, createClient = (config) => new Client(config), doc = document, win = window }) {
  const rooms = new Map(); // roomId → Set<handler(frame)>
  const stompSubs = new Map(); // roomId → STOMP 구독
  const statusListeners = new Set();
  const errorListeners = new Set();
  let client = null;
  let status = 'idle'; // idle · connecting · connected · disconnected · stopped
  let attempt = 0;
  let needsRefresh = false;
  let releaseTimer = null;
  let hidden = doc.visibilityState === 'hidden';

  const setStatus = (next) => {
    if (status === next) return;
    status = next;
    statusListeners.forEach((l) => l(next));
  };
  const emitError = (error) => errorListeners.forEach((l) => l(error));

  const subscribeStomp = (roomId) => {
    stompSubs.set(roomId, client.subscribe(`/sub/rooms/${roomId}`, (msg) => {
      const frame = JSON.parse(msg.body);
      rooms.get(roomId)?.forEach((h) => h(frame));
    }));
  };

  const stop = (next = 'idle') => {
    clearTimeout(releaseTimer);
    stompSubs.clear();
    if (client) {
      const c = client;
      client = null;
      void c.deactivate();
    }
    setStatus(next);
  };

  const start = () => {
    clearTimeout(releaseTimer);
    if (client || rooms.size === 0 || !getToken()) return;
    client = createClient({
      brokerURL: url,
      heartbeatIncoming: HEARTBEAT_MS,
      heartbeatOutgoing: HEARTBEAT_MS,
      reconnectDelay: reconnectDelay(0),
      beforeConnect: async () => {
        setStatus('connecting');
        if (needsRefresh) {
          needsRefresh = false;
          try {
            await refreshToken();
          } catch {
            stop('stopped'); // 재발급도 실패 = 로그아웃 상태
            return;
          }
        }
        const token = getToken();
        if (!token) {
          stop('stopped');
          return;
        }
        client.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        attempt = 0;
        client.reconnectDelay = reconnectDelay(0);
        client.subscribe(ERRORS_DESTINATION, (msg) => emitError(JSON.parse(msg.body)));
        stompSubs.clear();
        if (!hidden) rooms.forEach((_, roomId) => subscribeStomp(roomId));
        setStatus('connected');
      },
      onStompError: (frame) => {
        const message = frame.headers.message ?? '';
        if (message.startsWith('UNAUTHORIZED')) needsRefresh = true;
        if (message.startsWith('USER_BLOCKED')) {
          stop('stopped');
          return;
        }
        emitError({ code: message.split(':')[0], message });
      },
      onWebSocketClose: (event) => {
        if (!client) return;
        if (event?.code === 4429) {
          stop('stopped'); // 다른 탭 · 기기의 연결이 더 새로움 — 다시 붙으면 서로 밀어내므로 멈춘다
          return;
        }
        if (event?.code === 4401) needsRefresh = true;
        attempt += 1;
        client.reconnectDelay = reconnectDelay(attempt);
        setStatus('disconnected');
      },
    });
    client.activate();
  };

  const onVisibility = () => {
    hidden = doc.visibilityState === 'hidden';
    if (hidden) {
      stompSubs.forEach((sub) => sub.unsubscribe());
      stompSubs.clear();
    } else if (client?.connected) {
      rooms.forEach((_, roomId) => subscribeStomp(roomId));
      statusListeners.forEach((l) => l('connected')); // 가려진 동안 놓친 메시지 — 화면이 다시 받는다
    } else if (status !== 'stopped') {
      start();
    }
  };
  const onPageHide = () => stop();
  const onPageShow = (event) => {
    if (event.persisted && status !== 'stopped') start();
  };
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('pageshow', onPageShow);

  return {
    /** 방 구독 — 돌려준 함수로 해제. 마지막 해제면 잠시 뒤 연결을 끊는다 */
    subscribeRoom(roomId, handler) {
      const handlers = rooms.get(roomId) ?? new Set();
      handlers.add(handler);
      if (!rooms.has(roomId)) {
        rooms.set(roomId, handlers);
        if (client?.connected && !hidden) subscribeStomp(roomId);
      }
      if (status === 'stopped') setStatus('idle'); // 화면이 새로 구독하면 다시 시도
      start();
      return () => {
        handlers.delete(handler);
        if (handlers.size > 0) return;
        rooms.delete(roomId);
        stompSubs.get(roomId)?.unsubscribe();
        stompSubs.delete(roomId);
        if (rooms.size === 0) {
          clearTimeout(releaseTimer);
          releaseTimer = setTimeout(() => stop(), RELEASE_GRACE_MS);
        }
      };
    },
    /** 보내기 — 연결 전이면 false (화면이 입력을 지우지 않는다) */
    send(roomId, content) {
      if (!client?.connected) return false;
      client.publish({ destination: `/pub/rooms/${roomId}`, body: JSON.stringify({ content }), headers: { 'content-type': 'application/json' } });
      return true;
    },
    /** 입력 중 신호 — 연결돼 있고 화면이 보일 때만 (서버가 1초에 1번만 전달) */
    typing(roomId) {
      if (!client?.connected || hidden) return;
      client.publish({ destination: `/pub/rooms/${roomId}/typing`, body: '{}', headers: { 'content-type': 'application/json' } });
    },
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    onError(listener) {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
    get status() {
      return status;
    },
    /** 로그아웃 · 테스트 정리 */
    dispose() {
      rooms.clear();
      stop();
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pagehide', onPageHide);
      win.removeEventListener('pageshow', onPageShow);
    },
  };
}
