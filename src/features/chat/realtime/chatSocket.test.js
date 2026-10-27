import { createChatSocket, HIDDEN_DISCONNECT_MS, reconnectDelay, RELEASE_GRACE_MS } from '@/features/chat/realtime/chatSocket';

// STOMP 클라이언트는 가짜 — 연결 · 끊김 · 서버 프레임을 직접 흉내 내 연결 수명 규칙(chat.md 6-1절)을 확인한다
function fakeStomp() {
  const clients = [];
  const create = (config) => {
    const c = {
      config, connected: false, connectHeaders: {}, reconnectDelay: config.reconnectDelay, subs: [],
      activate: vi.fn(),
      deactivate: vi.fn(async () => { c.connected = false; }),
      subscribe: vi.fn((destination, callback) => {
        const sub = { destination, callback, unsubscribe: vi.fn() };
        c.subs.push(sub);
        return sub;
      }),
      publish: vi.fn(),
    };
    clients.push(c);
    return c;
  };
  return { create, clients, last: () => clients.at(-1) };
}

const connect = async (c) => {
  await c.config.beforeConnect();
  c.connected = true;
  c.config.onConnect();
};
const frame = (c, destination, body) => c.subs.find((s) => s.destination === destination).callback({ body: JSON.stringify(body) });

let stomp;
let doc;
let win;
let token;
let refreshToken;
let socket;

beforeEach(() => {
  vi.useFakeTimers();
  stomp = fakeStomp();
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  win = new EventTarget();
  token = 'token-1';
  refreshToken = vi.fn(async () => { token = 'token-2'; });
  socket = createChatSocket({ url: 'ws://test/ws/chat', getToken: () => token, refreshToken, createClient: stomp.create, doc, win });
});

afterEach(() => {
  socket.dispose();
  vi.useRealTimers();
});

describe('chatSocket — 필요할 때만 연결', () => {
  it('구독 전에는 연결하지 않고, 구독하면 토큰을 실어 연결 · 방과 오류 큐를 구독한다', async () => {
    expect(stomp.clients).toHaveLength(0);
    const handler = vi.fn();
    socket.subscribeRoom(7, handler);
    const c = stomp.last();
    expect(c.activate).toHaveBeenCalledOnce();
    expect(c.config).toMatchObject({ brokerURL: 'ws://test/ws/chat', heartbeatIncoming: 10_000, heartbeatOutgoing: 10_000 });

    expect(socket.send(7, '연결 전')).toBe(false);
    await connect(c);
    expect(c.connectHeaders).toEqual({ Authorization: 'Bearer token-1' });
    expect(c.subs.map((s) => s.destination)).toEqual(['/user/queue/errors', '/sub/rooms/7']);
    expect(socket.status).toBe('connected');

    frame(c, '/sub/rooms/7', { type: 'MESSAGE', messageId: 1 });
    expect(handler).toHaveBeenCalledWith({ type: 'MESSAGE', messageId: 1 });
    expect(socket.send(7, '안녕하세요')).toBe(true);
    expect(c.publish).toHaveBeenCalledWith({ destination: '/pub/rooms/7', body: '{"content":"안녕하세요"}', headers: { 'content-type': 'application/json' } });
  });

  it('토큰이 없으면 연결하지 않는다 · 연결 직전에 토큰이 사라지면 멈춘다', async () => {
    token = null;
    socket.subscribeRoom(7, vi.fn());
    expect(stomp.clients).toHaveLength(0);

    token = 'token-1';
    socket.subscribeRoom(8, vi.fn());
    token = null;
    await stomp.last().config.beforeConnect();
    expect(stomp.last().deactivate).toHaveBeenCalled();
    expect(socket.status).toBe('stopped');
  });

  it('연결 중에 다른 방을 구독하면 바로 구독 · 같은 방 화면이 둘이면 하나가 떠나도 유지', async () => {
    const offA = socket.subscribeRoom(7, vi.fn());
    await connect(stomp.last());
    const second = vi.fn();
    const offB = socket.subscribeRoom(7, second);
    socket.subscribeRoom(8, vi.fn());
    const c = stomp.last();
    expect(c.subs.map((s) => s.destination)).toEqual(['/user/queue/errors', '/sub/rooms/7', '/sub/rooms/8']);

    offA();
    expect(c.subs[1].unsubscribe).not.toHaveBeenCalled();
    frame(c, '/sub/rooms/7', { type: 'READ' });
    expect(second).toHaveBeenCalledOnce();
    offB();
    expect(c.subs[1].unsubscribe).toHaveBeenCalledOnce();
  });
});

describe('chatSocket — 안 쓰면 바로 끊기 (좀비 연결 방지)', () => {
  it('마지막 구독이 풀리면 잠시 뒤 끊고, 그 사이 다시 구독하면 연결을 유지한다', async () => {
    const off = socket.subscribeRoom(7, vi.fn());
    const c = stomp.last();
    await connect(c);
    off();
    vi.advanceTimersByTime(RELEASE_GRACE_MS - 1);
    socket.subscribeRoom(8, vi.fn()); // 다른 채팅 화면으로 이동
    vi.advanceTimersByTime(RELEASE_GRACE_MS);
    expect(c.deactivate).not.toHaveBeenCalled();

    socket.dispose();
    expect(c.deactivate).toHaveBeenCalledOnce();
  });

  it('구독이 모두 풀리고 시간이 지나면 끊는다', async () => {
    const off = socket.subscribeRoom(7, vi.fn());
    await connect(stomp.last());
    off();
    vi.advanceTimersByTime(RELEASE_GRACE_MS);
    expect(stomp.last().deactivate).toHaveBeenCalledOnce();
    expect(socket.status).toBe('idle');
  });

  it('탭이 오래 가려지면 끊고, 다시 보이면 새로 연결한다 (짧게 가렸다 보이면 그대로)', async () => {
    socket.subscribeRoom(7, vi.fn());
    const first = stomp.last();
    await connect(first);

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(HIDDEN_DISCONNECT_MS - 1);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(HIDDEN_DISCONNECT_MS);
    expect(first.deactivate).not.toHaveBeenCalled();
    expect(stomp.clients).toHaveLength(1);

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(HIDDEN_DISCONNECT_MS);
    expect(first.deactivate).toHaveBeenCalledOnce();

    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(stomp.clients).toHaveLength(2);
  });

  it('페이지를 떠나면(pagehide) 바로 끊고, 뒤로 가기 캐시로 돌아오면(pageshow persisted) 다시 연결', async () => {
    socket.subscribeRoom(7, vi.fn());
    await connect(stomp.last());
    win.dispatchEvent(new Event('pagehide'));
    expect(stomp.last().deactivate).toHaveBeenCalledOnce();

    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    expect(stomp.clients).toHaveLength(1);
    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(stomp.clients).toHaveLength(2);
  });

  it('dispose 뒤에는 화면 이벤트에 반응하지 않는다', () => {
    socket.subscribeRoom(7, vi.fn());
    socket.dispose();
    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(stomp.clients).toHaveLength(1);
  });
});

describe('chatSocket — 끊김 · 재연결', () => {
  it('끊기면 지연을 늘려 가며 재연결하고, 연결되면 처음 값으로 · 다시 연결되면 방을 다시 구독한다', async () => {
    const statuses = [];
    socket.onStatus((s) => statuses.push(s));
    socket.subscribeRoom(7, vi.fn());
    const c = stomp.last();
    await connect(c);
    c.config.onWebSocketClose({ code: 1006 });
    c.config.onWebSocketClose({ code: 1006 });
    expect(c.reconnectDelay).toBeGreaterThanOrEqual(2_000);
    expect(socket.status).toBe('disconnected');

    c.subs.length = 0;
    await connect(c);
    expect(c.reconnectDelay).toBeLessThanOrEqual(1_000);
    expect(c.subs.map((s) => s.destination)).toEqual(['/user/queue/errors', '/sub/rooms/7']);
    expect(statuses).toEqual(['connecting', 'connected', 'disconnected', 'connecting', 'connected']);
  });

  it('토큰 만료(4401)로 닫히면 다음 연결 전에 토큰을 새로 받는다 — 재발급도 실패하면 멈춘다', async () => {
    socket.subscribeRoom(7, vi.fn());
    const c = stomp.last();
    await connect(c);
    c.config.onWebSocketClose({ code: 4401 });
    await connect(c);
    expect(refreshToken).toHaveBeenCalledOnce();
    expect(c.connectHeaders).toEqual({ Authorization: 'Bearer token-2' });

    refreshToken.mockRejectedValueOnce(new Error('expired'));
    c.config.onStompError({ headers: { message: 'UNAUTHORIZED: 토큰이 만료됐습니다.' } });
    await c.config.beforeConnect();
    expect(socket.status).toBe('stopped');
  });

  it('연결 수 초과(4429)면 서로 밀어내지 않게 재연결하지 않는다 — 화면이 새로 구독하면 다시 시도', async () => {
    socket.subscribeRoom(7, vi.fn());
    const c = stomp.last();
    await connect(c);
    c.config.onWebSocketClose({ code: 4429 });
    expect(c.deactivate).toHaveBeenCalledOnce();
    expect(socket.status).toBe('stopped');

    doc.dispatchEvent(new Event('visibilitychange'));
    expect(stomp.clients).toHaveLength(1);
    socket.subscribeRoom(8, vi.fn());
    expect(stomp.clients).toHaveLength(2);
  });

  it('직접 끊은 뒤 늦게 온 닫힘 알림은 무시한다', async () => {
    socket.subscribeRoom(7, vi.fn());
    const c = stomp.last();
    await connect(c);
    win.dispatchEvent(new Event('pagehide'));
    c.config.onWebSocketClose({ code: 1000 });
    expect(socket.status).toBe('idle');
  });

  it('서버 오류: 업무 오류는 화면으로, 차단(USER_BLOCKED)이면 멈춘다', async () => {
    const errors = [];
    const off = socket.onError((e) => errors.push(e));
    socket.subscribeRoom(7, vi.fn());
    const c = stomp.last();
    await connect(c);

    frame(c, '/user/queue/errors', { code: 'CHAT_TOO_FAST', message: '너무 빨라요' });
    c.config.onStompError({ headers: { message: 'CHAT_ROOM_NOT_FOUND: 채팅방을 찾을 수 없습니다.' } });
    c.config.onStompError({ headers: {} });
    expect(errors.map((e) => e.code)).toEqual(['CHAT_TOO_FAST', 'CHAT_ROOM_NOT_FOUND', '']);

    off();
    c.config.onStompError({ headers: { message: 'USER_BLOCKED: 탈퇴한 계정' } });
    expect(errors).toHaveLength(3);
    expect(socket.status).toBe('stopped');
  });

  it('재연결 지연 — 1초에서 두 배씩 최대 30초, 절반~전부 사이 무작위', () => {
    expect(reconnectDelay(0, () => 1)).toBe(1_000);
    expect(reconnectDelay(0, () => 0)).toBe(500);
    expect(reconnectDelay(3, () => 1)).toBe(8_000);
    expect(reconnectDelay(10, () => 1)).toBe(30_000);
  });
});
