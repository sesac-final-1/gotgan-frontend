import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useToastStore } from '@/shared/stores/toastStore';
import NotificationBell from '@/features/notification/components/NotificationBell';
import { ago } from '@/features/notification/utils/ago';

// 실시간 연결은 가짜 — 넘겨받은 onmessage 로 서버 알림을 흉내 낸다
vi.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: vi.fn(() => new Promise(() => {})) }));

// admin-service 알림 센터 응답 흉내 (admin.md 5절)
const ITEMS = [
  { id: 'a1', type: 'ORDER_PAID', title: '결제가 완료됐어요', body: '머그 · 28,000원', link: '/mypage/orders/N1', read: false, createdAt: '2026-10-27T10:00:00+09:00' },
  { id: 'a2', type: 'SETTLEMENT_PAID', title: '정산금이 지급됐어요', body: null, link: '/seller/settlements', read: true, createdAt: '2026-10-26T10:00:00+09:00' },
];

let queryClient;
function renderBell() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<NotificationBell />} />
          <Route path="/mypage/orders/:no" element={<p>주문 상세 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'token-1', user: { userId: 4, name: '구매자1', roles: ['BUYER'] }, isAuthReady: true });
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({
    data: { data: url.endsWith('/unread-count') ? { count: 1 } : { items: ITEMS, nextCursor: null, unreadCount: 1 } },
  }));
  vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: null } });
});
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  vi.restoreAllMocks();
  fetchEventSource.mockClear();
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('알림 벨', () => {
  it('안 읽은 수를 보여 주고, 열면 목록 — 누르면 읽음 처리 후 그 화면으로', async () => {
    renderBell();
    const bell = await screen.findByRole('button', { name: '알림 1개' });

    fireEvent.click(bell);
    fireEvent.click(await screen.findByText('결제가 완료됐어요'));

    await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalledWith('/api/notifications/a1/read'));
    expect(await screen.findByText('주문 상세 화면')).toBeInTheDocument();
  });

  it('모두 읽음 — PATCH /read-all', async () => {
    renderBell();
    fireEvent.click(await screen.findByRole('button', { name: '알림 1개' }));
    fireEvent.click(await screen.findByText('모두 읽음'));

    await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalledWith('/api/notifications/read-all'));
  });

  it('실시간 — 토큰을 실어 연결하고, 새 알림이 오면 토스트 + 숫자를 다시 불러온다', async () => {
    renderBell();
    await screen.findByRole('button', { name: '알림 1개' });
    const [url, options] = fetchEventSource.mock.calls[0];
    expect(url).toBe('/api/notifications/stream'); // 테스트(개발) 빌드는 Vite 프록시 — 배포 빌드는 api.gotgan.click 직접
    expect(options.headers).toEqual({ Authorization: 'Bearer token-1' });

    axiosInstance.get.mockClear();
    act(() => options.onmessage({ event: 'notification', data: JSON.stringify({ ...ITEMS[0], id: 'a3', title: '배송이 시작됐어요' }) }));

    expect(useToastStore.getState().current?.msg).toBe('배송이 시작됐어요');
    await waitFor(() => expect(axiosInstance.get).toHaveBeenCalledWith('/api/notifications/unread-count'));
  });

  it('로그인하지 않으면 조회 · 연결하지 않음', async () => {
    useAuthStore.setState({ accessToken: null, user: null });
    renderBell();
    expect(screen.getByRole('button', { name: '알림 0개' })).toBeInTheDocument();
    expect(fetchEventSource).not.toHaveBeenCalled();
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });
});

describe('ago — 알림 시각', () => {
  const now = new Date('2026-10-27T12:00:00+09:00');
  it('방금 · N분 전 · N시간 전 · 하루 넘으면 월.일', () => {
    expect(ago(new Date('2026-10-27T11:59:40+09:00'), now)).toBe('방금');
    expect(ago(new Date('2026-10-27T11:15:00+09:00'), now)).toBe('45분 전');
    expect(ago(new Date('2026-10-27T03:00:00+09:00'), now)).toBe('9시간 전');
    expect(ago(new Date('2026-10-25T09:00:00+09:00'), now)).toBe('10.25');
  });
});
