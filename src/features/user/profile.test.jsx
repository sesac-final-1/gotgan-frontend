import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useToastStore } from '@/shared/stores/toastStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { changePassword, updateMe, withdraw } from '@/features/user/api/userApi';
import { passwordChangeSchema, profileSchema, toUpdateMeRequest } from '@/features/user/schemas';
import MyProfile from '@/features/user/components/MyProfile';
import MyProfilePage from '@/pages/mypage/MyProfilePage';

const ME = { userId: 4, email: 'buyer1@gotgan.com', name: '구매자1', nick: '곳간', phone: '010-0000-0004', grade: 'NORMAL',
  signupProvider: 'LOCAL', point: 0, totalSpent: 0, joinedAt: '2026-10-01T09:30:00+09:00' };
const apiError = (status, code, message) =>
  new AxiosError(message, 'ERR', {}, null, { status, data: { code, message, data: null }, statusText: '', headers: {}, config: {} });

let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
  act(() => useAuthStore.setState({ accessToken: null, user: null, isAuthReady: false }));
});

function renderProfile(me = ME, element = <MyProfile onWithdrawn={vi.fn()} />) {
  vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: me } });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/mypage/profile']}>
        <Routes>
          <Route path="/mypage/profile" element={element} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('회원정보 스키마 · 요청', () => {
  it('이름 필수 · 닉네임 30자 · 휴대폰은 비우거나 형식대로', () => {
    expect(profileSchema.safeParse({ name: ' ', nick: '', phone: '' }).success).toBe(false);
    expect(profileSchema.safeParse({ name: '김', nick: 'x'.repeat(31), phone: '' }).success).toBe(false);
    expect(profileSchema.safeParse({ name: '김', nick: '', phone: '02-123-4567' }).success).toBe(false);
    expect(profileSchema.safeParse({ name: '김', nick: '', phone: '' }).success).toBe(true);
  });

  it('바뀐 항목만 — 닉네임 비우면 삭제(""), 휴대폰은 하이픈만 다르면 그대로 · 비우면 보내지 않음', () => {
    const me = { name: '구매자1', nick: '곳간', phone: '010-0000-0004' };
    expect(toUpdateMeRequest(me, { name: '구매자1', nick: '곳간', phone: '01000000004' })).toEqual({});
    expect(toUpdateMeRequest(me, { name: '김곳간', nick: '', phone: '' })).toEqual({ name: '김곳간', nick: '' });
    expect(toUpdateMeRequest({ ...me, phone: '' }, { name: '구매자1', nick: '곳간', phone: '010-1234-5678' })).toEqual({ phone: '010-1234-5678' });
  });

  it('새 비밀번호 — 가입과 같은 규칙 · 확인 일치', () => {
    const base = { currentPassword: 'old', newPassword: 'New!pass2', newPasswordConfirm: 'New!pass2' };
    expect(passwordChangeSchema.safeParse(base).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ ...base, newPassword: 'short!', newPasswordConfirm: 'short!' }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, newPasswordConfirm: 'Other!pass' }).error.issues[0].path).toEqual(['newPasswordConfirm']);
  });

  it('API — PATCH /me 는 수정 후 내 정보를 화면 필드로, 비밀번호 PATCH · 탈퇴 DELETE', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { ...ME, name: '김곳간' } } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });
    await expect(updateMe({ name: '김곳간' })).resolves.toMatchObject({ id: 4, name: '김곳간' });
    expect(patch).toHaveBeenCalledWith('/api/users/me', { name: '김곳간' });
    await changePassword({ currentPassword: 'a', newPassword: 'b' });
    expect(patch).toHaveBeenLastCalledWith('/api/users/me/password', { currentPassword: 'a', newPassword: 'b' });
    await withdraw();
    expect(del).toHaveBeenCalledWith('/api/users/me');
  });
});

describe('MyProfile', () => {
  it('저장 — 바뀐 이름만 보내고 응답으로 화면 갱신', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { ...ME, name: '김곳간' } } });
    renderProfile();
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: ' 김곳간 ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('회원정보가 수정되었어요'));
    expect(patch).toHaveBeenCalledWith('/api/users/me', { name: '김곳간' });
    expect(screen.getByLabelText('이름')).toHaveValue('김곳간');
  });

  it('바뀐 게 없으면 요청 없음, 형식 오류는 칸에 표시', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch');
    renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: '저장' }));
    expect(useToastStore.getState().current.msg).toBe('바뀐 내용이 없어요');
    fireEvent.change(screen.getByLabelText('휴대폰'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByText('휴대폰 번호 형식이 올바르지 않아요')).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('소셜 가입 회원은 비밀번호 변경 버튼 대신 안내', async () => {
    renderProfile({ ...ME, signupProvider: 'KAKAO', phone: null });
    expect(await screen.findByText('카카오 계정으로 가입해 비밀번호가 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '비밀번호 변경' })).not.toBeInTheDocument();
  });

  it('비밀번호 변경 — 현재 비밀번호 불일치는 그 칸에, 성공하면 닫힘', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch')
      .mockRejectedValueOnce(apiError(400, 'USER_PASSWORD_MISMATCH', '현재 비밀번호가 일치하지 않습니다.'))
      .mockResolvedValueOnce({ data: {} });
    renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: '비밀번호 변경' }));
    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'New!pass2' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'New!pass2' } });

    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    expect(await screen.findByText('현재 비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    await waitFor(() => expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument());
    expect(patch).toHaveBeenLastCalledWith('/api/users/me/password', { currentPassword: 'wrong', newPassword: 'New!pass2' });
    expect(useToastStore.getState().current.msg).toBe('비밀번호를 변경했어요');
  });

  it('비밀번호 변경 — 이메일과 같은 새 비밀번호는 서버를 부르지 않음', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch');
    renderProfile({ ...ME, email: 'gotgan.user@mail.com' });
    fireEvent.click(await screen.findByRole('button', { name: '비밀번호 변경' }));
    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'old' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'GOTGAN.USER@MAIL.COM' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'GOTGAN.USER@MAIL.COM' } });
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    expect(screen.getByText('비밀번호는 이메일과 달라야 해요')).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('탈퇴 — 확인 체크 전에는 비활성, 판매자 409 는 안내만', async () => {
    vi.spyOn(axiosInstance, 'delete').mockRejectedValue(apiError(409, 'USER_SELLER_STORE_NOT_CLOSED', '스토어를 폐점한 뒤 탈퇴할 수 있습니다.'));
    const onWithdrawn = vi.fn();
    renderProfile(ME, <MyProfile onWithdrawn={onWithdrawn} />);
    fireEvent.click(await screen.findByRole('button', { name: '회원 탈퇴' }));
    const confirm = screen.getByRole('button', { name: '탈퇴하기' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByLabelText('위 내용을 확인했어요'));
    fireEvent.click(confirm);
    expect(await screen.findByRole('alert')).toHaveTextContent('스토어를 폐점한 뒤 탈퇴할 수 있습니다.');
    expect(onWithdrawn).not.toHaveBeenCalled();
  });
});

describe('MyProfilePage — 탈퇴 성공', () => {
  it('로그인 상태 · 캐시를 비우고 첫 화면으로', async () => {
    vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });
    useAuthStore.setState({ accessToken: 'at', user: { userId: 4, roles: ['BUYER'] }, isAuthReady: true });
    renderProfile(ME, <MyProfilePage />);
    fireEvent.click(await screen.findByRole('button', { name: '회원 탈퇴' }));
    fireEvent.click(screen.getByLabelText('위 내용을 확인했어요'));
    fireEvent.click(screen.getByRole('button', { name: '탈퇴하기' }));

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, user: null });
    expect(queryClient.getQueryData(['user', 'me'])).toBeUndefined();
  });
});
