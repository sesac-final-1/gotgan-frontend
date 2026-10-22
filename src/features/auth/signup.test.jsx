import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { signupSchema } from '@/features/auth/schemas';
import { checkEmailAvailability, signup } from '@/features/auth/api/authApi';
import ShopSignup from '@/features/auth/components/ShopSignup';

const USER = { userId: 9, name: '김곳간', roles: ['BUYER'], storeId: null };
const VALID = { email: 'new@gotgan.com', password: 'Gotgan!pass1', passwordConfirm: 'Gotgan!pass1', name: '김곳간', phone: '01012345678' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => useAuthStore.setState({ accessToken: null, user: null, isAuthReady: false }));
});

const apiError = (status, code, message) =>
  new AxiosError(message, 'ERR', {}, null, { status, data: { code, message, data: null }, statusText: '', headers: {}, config: {} });

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<ShopSignup />} />
        <Route path="/" element={<p>home page</p>} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fill = (values) => {
  const labels = { email: '이메일', password: '비밀번호', passwordConfirm: '비밀번호 확인', name: '이름', phone: '휴대폰 번호' };
  Object.entries(values).forEach(([k, v]) => fireEvent.change(screen.getByLabelText(labels[k]), { target: { value: v } }));
};
const checkEmail = () => fireEvent.click(screen.getByRole('button', { name: '중복확인' }));
const agreeAll = () => fireEvent.click(screen.getByText('전체 동의'));
const submit = () => fireEvent.click(screen.getByRole('button', { name: '가입하기' }));

describe('signupSchema', () => {
  it('서버 · realm 정책과 같은 비밀번호 규칙 · 확인 일치 · 이메일과 다름 · 휴대폰 형식', () => {
    expect(signupSchema.safeParse(VALID).success).toBe(true);
    const issue = (patch) => signupSchema.safeParse({ ...VALID, ...patch }).error.issues[0];
    expect(issue({ password: 'short!', passwordConfirm: 'short!' }).message).toContain('8자 이상');
    expect(issue({ password: 'nospecial123', passwordConfirm: 'nospecial123' }).message).toContain('특수문자');
    expect(issue({ passwordConfirm: 'Other!pass1' })).toMatchObject({ path: ['passwordConfirm'] });
    // 이메일과 같은 비밀번호(대소문자 무시) — 영문 · 특수문자(. @) 규칙은 통과해도 막는다
    expect(issue({ email: 'gotgan.user@mail.com', password: 'GOTGAN.USER@MAIL.COM', passwordConfirm: 'GOTGAN.USER@MAIL.COM' }))
      .toMatchObject({ path: ['password'] });
    expect(issue({ phone: '02-123-4567' })).toMatchObject({ path: ['phone'] });
  });
});

describe('authApi 가입', () => {
  it('중복확인 · 가입은 envelope 의 data', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { email: 'a@b.com', available: true } } });
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { userId: 9, login: null } } });
    await expect(checkEmailAvailability('a@b.com')).resolves.toEqual({ email: 'a@b.com', available: true });
    expect(get).toHaveBeenCalledWith('/api/auth/email-availability', { params: { email: 'a@b.com' } });
    await expect(signup({ email: 'a@b.com' })).resolves.toEqual({ userId: 9, login: null });
  });
});

describe('ShopSignup', () => {
  it('중복확인 → 필수 약관 → 가입 · 자동 로그인 → 첫 화면 (비밀번호 확인 · 공백은 보내지 않음)', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { email: 'new@gotgan.com', available: true } } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({
      data: { data: { userId: 9, login: { accessToken: 'at', expiresIn: 1800, user: USER } } } });
    renderSignup();
    fill({ ...VALID, email: ' New@gotgan.com ' });
    checkEmail();
    expect(await screen.findByText('사용할 수 있는 이메일이에요')).toBeInTheDocument();
    agreeAll();
    submit();

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/api/auth/signup',
      { email: 'New@gotgan.com', password: 'Gotgan!pass1', name: '김곳간', phone: '01012345678' });
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'at', user: USER });
  });

  it('자동 로그인 실패(login null) — 가입은 됐으니 로그인 화면으로', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { email: 'new@gotgan.com', available: true } } });
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { userId: 9, login: null } } });
    renderSignup();
    fill(VALID);
    checkEmail();
    await screen.findByText('사용할 수 있는 이메일이에요');
    agreeAll();
    submit();
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('이미 가입된 이메일 · 중복확인 안 함 · 확인 후 이메일 변경 · 필수 약관 미동의는 가입 요청 없음', async () => {
    const get = vi.spyOn(axiosInstance, 'get')
      .mockResolvedValueOnce({ data: { data: { email: 'new@gotgan.com', available: false } } })
      .mockResolvedValueOnce({ data: { data: { email: 'new@gotgan.com', available: true } } });
    const post = vi.spyOn(axiosInstance, 'post');
    renderSignup();
    fill(VALID);

    submit();
    expect(await screen.findByText('이메일 중복확인을 해주세요')).toBeInTheDocument();
    checkEmail();
    expect(await screen.findByText('이미 가입된 이메일이에요')).toBeInTheDocument();
    checkEmail();
    await screen.findByText('사용할 수 있는 이메일이에요');
    fill({ email: 'other@gotgan.com' });
    submit();
    expect(await screen.findByText('이메일 중복확인을 해주세요')).toBeInTheDocument();
    fill({ email: 'new@gotgan.com' });
    fireEvent.click(screen.getByText('(필수) 만 14세 이상입니다'));
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('필수 약관에 모두 동의해주세요');

    expect(get).toHaveBeenCalledTimes(2);
    expect(post).not.toHaveBeenCalled();
  });

  it('형식 오류는 칸마다 표시, 중복확인도 이메일 형식부터', async () => {
    const get = vi.spyOn(axiosInstance, 'get');
    renderSignup();
    fill({ ...VALID, email: 'nope', passwordConfirm: 'different!1', phone: '123' });
    checkEmail();
    expect(await screen.findByText('이메일 형식이 올바르지 않아요')).toBeInTheDocument();
    submit();
    expect(await screen.findByText('비밀번호가 일치하지 않아요')).toBeInTheDocument();
    expect(screen.getByText('휴대폰 번호 형식이 올바르지 않아요')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('서버 오류 — 이메일 중복(동시 가입)은 이메일 칸, 비밀번호 정책은 비밀번호 칸, 그 외는 아래 안내', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { email: 'new@gotgan.com', available: true } } });
    vi.spyOn(axiosInstance, 'post')
      .mockRejectedValueOnce(apiError(400, 'AUTH_PASSWORD_POLICY_VIOLATION', '비밀번호 정책 위반'))
      .mockRejectedValueOnce(apiError(502, 'EXTERNAL_API_ERROR', '외부 서비스 호출에 실패했습니다.'))
      .mockRejectedValueOnce(apiError(409, 'AUTH_EMAIL_DUPLICATE', '이미 가입된 이메일입니다.'));
    renderSignup();
    fill(VALID);
    checkEmail();
    await screen.findByText('사용할 수 있는 이메일이에요');
    agreeAll();

    submit();
    expect(await screen.findByText('비밀번호 정책 위반')).toBeInTheDocument();
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('외부 서비스 호출에 실패했습니다.'));
    submit();
    expect(await screen.findByText('이미 가입된 이메일입니다.')).toBeInTheDocument();
    expect(screen.queryByText('사용할 수 있는 이메일이에요')).not.toBeInTheDocument();
  });
});
