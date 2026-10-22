import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { roleMismatchMessage, LOGIN_TABS } from '@/features/auth/constants';
import { loginSchema } from '@/features/auth/schemas';
import { restoreSession } from '@/features/auth/session';
import ShopLogin from '@/features/auth/components/ShopLogin';
import RequireRole from '@/features/auth/components/RequireRole';

const BUYER = { userId: 4, name: '구매자1', roles: ['BUYER'], storeId: null };
const SELLER = { userId: 2, name: '판매자1', roles: ['BUYER', 'SELLER'], storeId: 1 };

afterEach(() => {
  cleanup(); // 화면을 먼저 내린 뒤 스토어 초기화 — 구독 중인 컴포넌트가 act 밖에서 다시 그려지지 않게
  vi.restoreAllMocks();
  act(() => useAuthStore.setState({ accessToken: null, user: null, isAuthReady: false }));
});

const loginOk = (user) => ({ data: { data: { accessToken: 'at', expiresIn: 1800, user } } });
const apiError = (status, code, message) =>
  new AxiosError(message, 'ERR', {}, null, { status, data: { code, message, data: null }, statusText: '', headers: {}, config: {} });

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<ShopLogin />} />
        <Route path="/" element={<p>home page</p>} />
        <Route path="/seller" element={<p>seller page</p>} />
        <Route path="/mypage/points" element={<p>points page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fillAndSubmit = (email, password) => {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
};

describe('loginSchema', () => {
  it('이메일 형식 · 빈 비밀번호를 막고, 이메일 앞뒤 공백은 지운다', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
    expect(loginSchema.parse({ email: '  a@b.com ', password: 'pw' })).toEqual({ email: 'a@b.com', password: 'pw' });
  });
});

describe('ShopLogin', () => {
  it('구매회원 탭 성공 — 이메일 · 비밀번호로 로그인, AT · 사용자 저장 후 첫 화면', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue(loginOk(BUYER));
    renderLogin();
    fillAndSubmit(' buyer1@gotgan.com ', 'pw');

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/api/auth/login', { email: 'buyer1@gotgan.com', password: 'pw' });
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'at', user: BUYER, isAuthReady: true });
  });

  it('판매자 탭 — 가드가 보낸 원래 화면이 있으면 그리로', async () => {
    vi.spyOn(axiosInstance, 'post').mockResolvedValue(loginOk(SELLER));
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/mypage/points' } }]}>
        <Routes>
          <Route path="/login" element={<ShopLogin />} />
          <Route path="/mypage/points" element={<p>points page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: '판매자' }));
    fillAndSubmit('seller1@gotgan.com', 'pw');
    expect(await screen.findByText('points page')).toBeInTheDocument();
  });

  it('고른 탭의 역할이 없는 계정 — 세션을 끝내고(로그아웃) 안내, 로그인 상태로 두지 않음', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockImplementation((url) =>
      Promise.resolve(url === '/api/auth/login' ? loginOk(BUYER) : { data: {} }));
    renderLogin();
    fireEvent.click(screen.getByRole('tab', { name: '운영자' }));
    fillAndSubmit('buyer1@gotgan.com', 'pw');

    expect(await screen.findByRole('alert')).toHaveTextContent(roleMismatchMessage(LOGIN_TABS[2]));
    expect(post).toHaveBeenCalledWith('/api/auth/logout');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('서버 오류는 ApiResponse.message 그대로 (비밀번호 불일치 · 정지)', async () => {
    vi.spyOn(axiosInstance, 'post')
      .mockRejectedValueOnce(apiError(401, 'AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.'))
      .mockRejectedValueOnce(apiError(403, 'AUTH_ACCOUNT_DISABLED', '이용이 정지된 계정입니다.'));
    renderLogin();

    fillAndSubmit('buyer1@gotgan.com', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 올바르지 않습니다.');
    fillAndSubmit('buyer1@gotgan.com', 'pw');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('이용이 정지된 계정입니다.'));
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('형식 오류는 서버를 부르지 않는다', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    renderLogin();
    fillAndSubmit('not-an-email', 'pw');
    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 형식이 올바르지 않아요');
    expect(post).not.toHaveBeenCalled();
  });

  it('구매회원 탭에서만 소셜 로그인 · 회원가입 안내', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: '카카오 로그인' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '판매자' }));
    expect(screen.queryByRole('link', { name: '카카오 로그인' })).not.toBeInTheDocument();
  });
});

describe('restoreSession (부팅)', () => {
  it('RT 쿠키가 살아 있으면 로그인 복구, 없으면 비로그인 — 둘 다 isAuthReady', async () => {
    vi.spyOn(axiosInstance, 'post').mockResolvedValueOnce(loginOk(BUYER)).mockRejectedValueOnce(apiError(401, 'AUTH_SESSION_EXPIRED', '만료'));
    await restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ user: BUYER, isAuthReady: true });
    await restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ user: null, accessToken: null, isAuthReady: true });
  });
});

describe('RequireRole', () => {
  const renderGuard = () => render(
    <MemoryRouter initialEntries={['/seller']}>
      <Routes>
        <Route path="/seller" element={<RequireRole role="SELLER"><p>seller page</p></RequireRole>} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );

  it('부팅 복구 전에는 판단하지 않는다 (새로고침 시 잘못된 리다이렉트 방지)', () => {
    renderGuard();
    expect(screen.getByText('불러오는 중이에요…')).toBeInTheDocument();
  });

  it('비로그인 → 로그인 화면', () => {
    useAuthStore.setState({ isAuthReady: true, user: null });
    renderGuard();
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('역할 없음 → 권한 안내, 역할 있음 → 화면', () => {
    useAuthStore.setState({ isAuthReady: true, user: BUYER });
    const { unmount } = renderGuard();
    expect(screen.getByText('이 화면을 볼 수 있는 권한이 없어요')).toBeInTheDocument();
    unmount();
    useAuthStore.setState({ isAuthReady: true, user: SELLER });
    renderGuard();
    expect(screen.getByText('seller page')).toBeInTheDocument();
  });
});
