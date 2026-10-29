import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useToastStore } from '@/shared/stores/toastStore';
import ChatInbox from '@/features/chat/components/ChatInbox';
import OpenChatButton from '@/features/chat/components/OpenChatButton';
import { getChatSocket, resetChatSocket } from '@/features/chat/hooks/useChatRoomSocket';

// 실시간 연결은 가짜 — 화면이 구독한 방 · 보낸 메시지를 기록하고, 테스트가 서버 프레임 · 연결 상태를 흉내 낸다
const fake = vi.hoisted(() => ({ handlers: new Map(), status: [], errors: [], sent: [], typing: [], connected: true }));
vi.mock('@/features/chat/realtime/chatSocket', () => ({
  createChatSocket: vi.fn(() => ({
    subscribeRoom: (roomId, handler) => {
      fake.handlers.set(roomId, handler);
      return () => fake.handlers.delete(roomId);
    },
    send: (roomId, content) => {
      if (!fake.connected) return false;
      fake.sent.push({ roomId, content });
      return true;
    },
    typing: (roomId) => fake.typing.push(roomId),
    onStatus: (l) => { fake.status.push(l); return () => {}; },
    onError: (l) => { fake.errors.push(l); return () => {}; },
    status: 'connected',
    dispose: vi.fn(),
  })),
}));

const ROOMS = [
  { roomId: 7, type: 'STORE_INQUIRY', status: null, counterpart: { name: '스토어 #5', role: 'SELLER' }, storeId: 5, buyerId: 10,
    lastMessage: { preview: '안녕하세요', at: '2026-10-27T10:00:00+09:00' }, unreadCount: 2, createdAt: '2026-10-27T09:00:00+09:00' },
  { roomId: 9, type: 'BUYER_SUPPORT', status: 'OPEN', counterpart: { name: '곳간 운영팀', role: 'ADMIN' }, storeId: null, buyerId: 10,
    lastMessage: null, unreadCount: 0, createdAt: '2026-10-27T09:00:00+09:00' },
];
const MESSAGES = [
  { messageId: 2, roomId: 7, senderRole: 'BUYER', mine: true, kind: 'TEXT', content: '배송 언제 되나요?', context: null, createdAt: '2026-10-27T10:00:00+09:00' },
  { messageId: 1, roomId: 7, senderRole: 'BUYER', mine: true, kind: 'CONTEXT', content: '상품 #101', context: { type: 'PRODUCT', id: 101, title: '상품 #101' }, createdAt: '2026-10-27T09:59:00+09:00' },
];

function renderAt(path, element, routePath) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path={`${routePath.replace('/:roomId', '')}`} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

let rooms;
beforeEach(() => {
  rooms = ROOMS;
  fake.handlers.clear();
  fake.status.length = 0;
  fake.errors.length = 0;
  fake.sent.length = 0;
  fake.typing.length = 0;
  fake.connected = true;
  useToastStore.setState({ current: null });
  useAuthStore.setState({ accessToken: 't', user: { userId: 10, name: '구매자', roles: ['BUYER'] }, isAuthReady: true });
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({
    data: { data: url.endsWith('/messages') ? MESSAGES : url.endsWith('/unread-count') ? { count: 2 } : rooms },
  }));
  vi.spyOn(axiosInstance, 'patch').mockImplementation(async (url, body) => ({ data: { data: { ...ROOMS[1], status: body.status } } }));
  vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { ...ROOMS[1], roomId: 12 } } });
});
afterEach(() => {
  cleanup();
  resetChatSocket();
  vi.restoreAllMocks();
});

describe('채팅함', () => {
  it('목록 → 방을 열면 그 방만 구독하고 메시지 · 읽음 처리, 실시간 새 메시지 · 상대 읽음 표시', async () => {
    renderAt('/mypage/chats/7', <ChatInbox kind="buyer" basePath="/mypage/chats" />, '/mypage/chats/:roomId');

    expect((await screen.findAllByText('스토어 #5')).length).toBeGreaterThan(0);
    expect(await screen.findByText('배송 언제 되나요?')).toBeInTheDocument();
    expect(screen.getByText('상품 문의')).toBeInTheDocument();
    expect([...fake.handlers.keys()]).toEqual([7]);
    await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalledWith('/api/chats/rooms/7/read', { lastMessageId: 2 }));

    act(() => fake.handlers.get(7)({ type: 'MESSAGE', messageId: 3, roomId: 7, senderRole: 'SELLER', kind: 'TEXT', content: '내일 출발해요', context: null, createdAt: '2026-10-27T10:01:00+09:00' }));
    expect(await screen.findByText('내일 출발해요')).toBeInTheDocument();
    act(() => fake.handlers.get(7)({ type: 'READ', userRole: 'BUYER', lastMessageId: 99 })); // 내 읽음은 무시
    expect(screen.queryByText('읽음')).not.toBeInTheDocument();
    act(() => fake.handlers.get(7)({ type: 'READ', userRole: 'SELLER', lastMessageId: 2 }));
    expect(await screen.findByText('읽음')).toBeInTheDocument();
    act(() => fake.handlers.get(7)({ type: 'STATUS', status: 'OPEN' }));
    act(() => fake.status.forEach((l) => l('connected'))); // 다시 연결 → 메시지 다시 받기
    act(() => fake.status.forEach((l) => l('disconnected')));
    expect(screen.getByText(/다시 연결하는 중/)).toBeInTheDocument();
  });

  it('보내기 — Enter 로 보내고 입력을 비움, 빈 메시지 · 연결 전은 안내만, 서버 오류는 토스트', async () => {
    renderAt('/mypage/chats/7', <ChatInbox kind="buyer" basePath="/mypage/chats" />, '/mypage/chats/:roomId');
    const input = await screen.findByPlaceholderText(/메시지 입력/);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useToastStore.getState().current.msg).toBe('메시지를 입력해 주세요.');
    expect(fake.sent).toHaveLength(0);

    fireEvent.change(input, { target: { value: '안녕하세요' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(fake.sent).toEqual([{ roomId: 7, content: '안녕하세요' }]);
    expect(input.value).toBe('');

    fake.connected = false;
    fireEvent.change(input, { target: { value: '끊긴 상태' } });
    fireEvent.click(screen.getByText('보내기'));
    expect(input.value).toBe('끊긴 상태');
    expect(useToastStore.getState().current.msg).toMatch('연결 중');

    act(() => fake.errors.forEach((l) => l({ code: 'CHAT_TOO_FAST', message: 'x' })));
    expect(useToastStore.getState().current.msg).toMatch('너무 빨리');
    act(() => fake.errors.forEach((l) => l({ code: 'INVALID_INPUT', message: '메시지는 1~1000자로 보내 주세요.' })));
    expect(useToastStore.getState().current.msg).toMatch('1~1000자');
  });

  it('입력 중 — 입력하면 3초에 한 번 신호, 상대 TYPING 을 받으면 5초 동안 표시 · 메시지가 오면 사라짐', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100_000);
    renderAt('/mypage/chats/7', <ChatInbox kind="buyer" basePath="/mypage/chats" />, '/mypage/chats/:roomId');
    const input = await screen.findByPlaceholderText(/메시지 입력/);
    fireEvent.change(input, { target: { value: '안' } });
    fireEvent.change(input, { target: { value: '안녕' } });
    fireEvent.change(input, { target: { value: '   ' } });
    expect(fake.typing).toEqual([7]);
    Date.now.mockReturnValue(103_000);
    fireEvent.change(input, { target: { value: '안녕하' } });
    expect(fake.typing).toEqual([7, 7]);

    act(() => fake.handlers.get(7)({ type: 'TYPING', userRole: 'BUYER' })); // 내 신호는 무시
    expect(screen.queryByText(/입력 중/)).not.toBeInTheDocument();
    act(() => fake.handlers.get(7)({ type: 'TYPING', userRole: 'SELLER' }));
    expect(screen.getByText('스토어 #5 님이 입력 중…')).toBeInTheDocument();
    act(() => fake.handlers.get(7)({ type: 'MESSAGE', messageId: 5, roomId: 7, senderRole: 'SELLER', kind: 'TEXT', content: '답장', context: null, createdAt: '2026-10-27T10:02:00+09:00' }));
    expect(screen.queryByText(/입력 중/)).not.toBeInTheDocument();

    vi.useFakeTimers();
    act(() => fake.handlers.get(7)({ type: 'TYPING', userRole: 'SELLER' }));
    expect(screen.getByText(/입력 중/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText(/입력 중/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('스토어 톡에서 운영팀에 도움 요청 → 고객 상담방으로 이동', async () => {
    renderAt('/mypage/chats/7', <ChatInbox kind="buyer" basePath="/mypage/chats" />, '/mypage/chats/:roomId');
    fireEvent.click(await screen.findByText('운영팀에 도움 요청'));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/api/chats/rooms', { type: 'BUYER_SUPPORT', context: { type: 'CHAT_ROOM', id: 7 } }));
  });

  it('판매자: 스토어 톡에서 상대 구매자를 회원 신고 (REV-12) — 구매자 화면에는 버튼 없음', async () => {
    useAuthStore.setState({ user: { userId: 2, name: '판매자', roles: ['SELLER'], storeId: 5 } });
    rooms = [{ ...ROOMS[0], counterpart: { name: '김*연', role: 'BUYER' } }];
    axiosInstance.post.mockResolvedValue({ data: { data: { reportId: 77, status: 'OPEN' } } });
    renderAt('/seller/chats/7', <ChatInbox kind="seller" basePath="/seller/chats" />, '/seller/chats/:roomId');

    fireEvent.click(await screen.findByText('구매자 신고'));
    fireEvent.click(screen.getByRole('button', { name: '신고하기' }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ targetType: 'USER', targetId: 10 })));
    cleanup();

    useAuthStore.setState({ user: { userId: 10, name: '구매자', roles: ['BUYER'] } });
    rooms = ROOMS;
    renderAt('/mypage/chats/7', <ChatInbox kind="buyer" basePath="/mypage/chats" />, '/mypage/chats/:roomId');
    expect(await screen.findByText('운영팀에 도움 요청')).toBeInTheDocument();
    expect(screen.queryByText('구매자 신고')).not.toBeInTheDocument();
  });

  it('관리자: 상담 종료 버튼 · 탭 이동 · 도움 요청된 스토어 톡은 읽기 전용', async () => {
    useAuthStore.setState({ user: { userId: 1, name: '관리자', roles: ['ADMIN'] } });
    rooms = [{ ...ROOMS[1], counterpart: { name: '회원 #10', role: 'BUYER' } }];
    renderAt('/admin/chats/9', <ChatInbox kind="admin" basePath="/admin/chats" />, '/admin/chats/:roomId');

    fireEvent.click(await screen.findByText('상담 종료'));
    await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalledWith('/api/chats/rooms/9/status', { status: 'RESOLVED' }));
    fireEvent.click(screen.getByText('종료'));
    cleanup();

    renderAt('/admin/chats/7', <ChatInbox kind="admin" basePath="/admin/chats" />, '/admin/chats/:roomId');
    expect(await screen.findByText(/관리자는 읽기만/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/메시지 입력/)).not.toBeInTheDocument();
  });

  it('방을 고르기 전 · 없는 방 안내, 방이 없으면 빈 목록', async () => {
    rooms = [];
    renderAt('/mypage/chats', <ChatInbox kind="buyer" basePath="/mypage/chats" />, '/mypage/chats/:roomId');
    expect(await screen.findByText('대화가 없어요')).toBeInTheDocument();
    expect(screen.getByText('왼쪽에서 대화를 고르세요.')).toBeInTheDocument();
    cleanup();
    renderAt('/mypage/chats/404', <ChatInbox kind="buyer" basePath="/mypage/chats" />, '/mypage/chats/:roomId');
    expect(await screen.findByText('대화방을 찾을 수 없어요.')).toBeInTheDocument();
  });
});

describe('OpenChatButton', () => {
  it('방을 열고 그 방으로 이동 · 로그인 전이면 로그인 화면', async () => {
    const queryClient = new QueryClient();
    const view = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/help']}>
          <Routes>
            <Route path="/help" element={<OpenChatButton basePath="/mypage/chats" request={{ type: 'BUYER_SUPPORT' }}>운영팀과 채팅</OpenChatButton>} />
            <Route path="/mypage/chats/:roomId" element={<p>채팅방 화면</p>} />
            <Route path="/login" element={<p>로그인 화면</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    render(view);
    fireEvent.click(screen.getByText('운영팀과 채팅'));
    expect(await screen.findByText('채팅방 화면')).toBeInTheDocument();
    cleanup();

    useAuthStore.setState({ user: null, accessToken: null });
    render(view);
    fireEvent.click(screen.getByText('운영팀과 채팅'));
    expect(await screen.findByText('로그인 화면')).toBeInTheDocument();
  });

  it('실시간 연결은 하나를 같이 쓴다', () => {
    expect(getChatSocket()).toBe(getChatSocket());
  });
});
