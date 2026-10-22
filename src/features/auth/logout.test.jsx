import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { axiosInstance, setAuthHandlers } from '@/shared/api/axiosInstance';
import { useToastStore } from '@/shared/stores/toastStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { bootstrap } from '@/app/bootstrap';

const BUYER = { userId: 4, name: '구매자1', roles: ['BUYER'], storeId: null };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setAuthHandlers({ getAccessToken: () => null, refresh: null, onAuthFailed: () => {} });
  act(() => useAuthStore.setState({ accessToken: null, user: null, isAuthReady: false }));
});

function LogoutButton() {
  const logout = useLogout();
  return <button type="button" onClick={logout}>로그아웃</button>;
}

function renderLogout(queryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/mypage']}>
        <Routes>
          <Route path="/mypage" element={<LogoutButton />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('useLogout', () => {
  it.each([
    ['서버 로그아웃 성공', () => Promise.resolve({ data: {} })],
    ['서버 로그아웃 실패(네트워크)해도 화면은 로그아웃', () => Promise.reject(new Error('network'))],
  ])('%s — AT · 사용자 삭제, 캐시 비움, 첫 화면', async (_, response) => {
    const post = vi.spyOn(axiosInstance, 'post').mockImplementation(response);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['users', 'me'], { name: '구매자1' });
    useAuthStore.setState({ accessToken: 'at', user: BUYER, isAuthReady: true });
    renderLogout(queryClient);

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/api/auth/logout');
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, user: null, isAuthReady: true });
    expect(queryClient.getQueryData(['users', 'me'])).toBeUndefined();
    expect(useToastStore.getState().current.msg).toBe('로그아웃되었어요');
  });
});

describe('bootstrap', () => {
  const ok = (config, data) => Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });

  it('부팅 시 로그인 복구 → 이후 요청에 그 AT 를 싣는다', async () => {
    const original = axiosInstance.defaults.adapter;
    const adapter = vi.fn((config) => (config.url === '/api/auth/refresh'
      ? ok(config, { data: { accessToken: 'restored-at', expiresIn: 1800, user: BUYER } })
      : ok(config, { data: null })));
    axiosInstance.defaults.adapter = adapter;
    try {
      await bootstrap();
      expect(useAuthStore.getState()).toMatchObject({ accessToken: 'restored-at', user: BUYER, isAuthReady: true });

      await axiosInstance.get('/api/users/me');
      expect(adapter.mock.calls.at(-1)[0].headers.Authorization).toBe('Bearer restored-at');
    } finally {
      axiosInstance.defaults.adapter = original;
    }
  });

  it('AT 만료(401) → 부팅 때 이은 재발급으로 새 AT 저장 후 재시도, 재발급 실패면 비로그인', async () => {
    const original = axiosInstance.defaults.adapter;
    let refreshOk = true;
    axiosInstance.defaults.adapter = vi.fn((config) => {
      if (config.url === '/api/auth/refresh') {
        return refreshOk
          ? ok(config, { data: { accessToken: 'new-at', expiresIn: 1800, user: BUYER } })
          : Promise.reject(Object.assign(new Error('expired'), { response: { status: 401 }, config }));
      }
      if (config.headers.Authorization === 'Bearer new-at') return ok(config, { data: 'ok' });
      return Promise.reject(Object.assign(new Error('401'), { response: { status: 401 }, config }));
    });
    try {
      refreshOk = false;
      await bootstrap(); // 부팅 복구 실패 → 비로그인
      expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthReady: true });

      act(() => useAuthStore.setState({ accessToken: 'expired-at', user: BUYER }));
      refreshOk = true;
      const res = await axiosInstance.get('/api/users/me');
      expect(res.data.data).toBe('ok');
      expect(useAuthStore.getState().accessToken).toBe('new-at');

      act(() => useAuthStore.setState({ accessToken: 'expired-at' }));
      refreshOk = false;
      await expect(axiosInstance.get('/api/users/me')).rejects.toThrow('401');
      expect(useAuthStore.getState()).toMatchObject({ accessToken: null, user: null });
    } finally {
      axiosInstance.defaults.adapter = original;
    }
  });
});
