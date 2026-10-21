import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useToastStore } from '@/shared/stores/toastStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { refreshToken, socialLoginUrl } from '@/features/auth/api/authApi';
import { homePathFor, socialErrorMessage, SOCIAL_PROVIDERS } from '@/features/auth/constants';
import SocialCallback from '@/features/auth/components/SocialCallback';
import SocialLoginButtons from '@/features/auth/components/SocialLoginButtons';

const USER = { userId: 7, name: '카카오회원', roles: ['BUYER'], storeId: null };

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ accessToken: null, user: null, isAuthReady: false });
});

describe('auth constants', () => {
  it('역할별 첫 화면 — 운영자 > 판매자 > 구매자', () => {
    expect(homePathFor(['BUYER', 'ADMIN'])).toBe('/admin');
    expect(homePathFor(['BUYER', 'SELLER'])).toBe('/seller');
    expect(homePathFor(['BUYER'])).toBe('/');
    expect(homePathFor()).toBe('/');
  });

  it('모르는 오류 코드는 일반 실패 문구', () => {
    expect(socialErrorMessage('AUTH_EMAIL_DUPLICATE')).toContain('이미 가입된 이메일');
    expect(socialErrorMessage('WHATEVER')).toBe(socialErrorMessage('AUTH_SOCIAL_LOGIN_FAILED'));
    expect(socialErrorMessage()).toBe(socialErrorMessage('AUTH_SOCIAL_LOGIN_FAILED'));
  });
});

describe('authApi', () => {
  it('소셜 로그인 시작은 같은 출처 상대경로', () => {
    expect(socialLoginUrl('kakao')).toBe('/api/auth/social/kakao');
  });

  it('refresh 는 응답 envelope 의 data 를 돌려준다', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { code: 'OK', data: { accessToken: 'at', user: USER } } });
    await expect(refreshToken()).resolves.toEqual({ accessToken: 'at', user: USER });
    expect(post).toHaveBeenCalledWith('/api/auth/refresh');
  });
});

describe('authStore', () => {
  it('로그인 · 로그아웃 모두 isAuthReady 를 켠다', () => {
    useAuthStore.getState().setAuth({ accessToken: 'at', user: USER });
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'at', user: USER, isAuthReady: true });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, user: null, isAuthReady: true });
  });
});

describe('SocialLoginButtons', () => {
  it('제공자마다 백엔드 시작 주소로 가는 링크', () => {
    render(<SocialLoginButtons />);
    SOCIAL_PROVIDERS.forEach((p) => {
      expect(screen.getByRole('link', { name: p.label })).toHaveAttribute('href', `/api/auth/social/${p.id}`);
    });
  });
});

describe('SocialCallback', () => {
  // StrictMode — 개발 모드처럼 effect 이중 실행에서도 refresh 가 한 번인지 함께 확인
  const renderAt = (url) => render(
    <StrictMode>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/auth/callback" element={<SocialCallback />} />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );

  it('성공 — refresh 한 번으로 AT · 사용자 저장 후 역할 첫 화면', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { accessToken: 'at', user: USER } } });
    renderAt('/auth/callback');
    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'at', user: USER });
  });

  it('?error= — refresh 없이 안내 후 로그인 화면', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    renderAt('/auth/callback?error=AUTH_EMAIL_DUPLICATE');
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    expect(useToastStore.getState().current.msg).toBe(socialErrorMessage('AUTH_EMAIL_DUPLICATE'));
  });

  it('refresh 실패 — 비로그인 상태로 로그인 화면', async () => {
    vi.spyOn(axiosInstance, 'post').mockRejectedValue(new Error('401'));
    renderAt('/auth/callback');
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, isAuthReady: true });
  });
});
