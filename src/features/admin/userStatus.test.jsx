import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useToastStore } from '@/shared/stores/toastStore';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { suspensionLabel, toUserStatusRequest } from '@/features/admin/constants';
import UserDetail from '@/features/admin/components/UserDetail';
import UserList from '@/features/admin/components/UserList';

// 상세 화면의 포인트 · 리뷰 목업 조회가 늦게 끝나도 act 안에서 반영되게 — 진행 중인 조회가 모두 끝난 뒤 정리
// (한 틱만 기다리면 커버리지 측정처럼 느린 실행에서 조회가 테스트보다 늦게 끝나 경고가 남)
let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
});

// admin-service 응답 흉내 (backend #94 — user 내부 API 그대로 전달). 상세 · 목록 · 포인트 · 작성 리뷰(backend #173)를 URL 로 나눠 돌려준다
const USER = { userId: 4, email: 'buyer1@gotgan.com', name: '구매자1', nick: null, grade: 'NORMAL', status: 'ACTIVE', signupProvider: 'LOCAL',
  point: 1500, totalSpent: 320000, joinedAt: '2026-10-01T09:30:00+09:00', lastLoginAt: '2026-10-25T10:00:00+09:00', phone: '010-0000-0001' };
const SUSPENDED = { ...USER, userId: 11, name: '정지회원', status: 'SUSPENDED', statusReason: '허위 리뷰', suspendedAt: '2026-10-25T10:00:00+09:00', suspendedUntil: '2026-11-01T10:00:00+09:00' };
function stubAdminApi() {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
    if (url === '/api/admin/users') return { data: { data: { content: [USER, SUSPENDED], hasNext: false } } };
    if (url.endsWith('/points')) return { data: { data: { balance: 1500, history: { content: [] } } } };
    if (url.endsWith('/reviews')) return { data: { data: { content: [
      { reviewId: 31, productId: 101, productName: '린넨 셔츠', rating: 1, content: '사진과 달라요', blinded: true, createdAt: '2026-10-20T14:00:00+09:00' }] } } };
    return { data: { data: url.endsWith('/11') ? SUSPENDED : USER } };
  });
  vi.spyOn(axiosInstance, 'patch').mockImplementation(async (url, body) => ({ data: { data: { ...SUSPENDED, status: body.status } } }));
}

describe('toUserStatusRequest — PATCH /api/admin/users/{id}/status 본문', () => {
  it('정지: 7일 · 30일은 days, 영구는 days 를 보내지 않음', () => {
    expect(toUserStatusRequest({ suspend: true, duration: '7', reason: '허위 리뷰' })).toEqual({ status: 'SUSPENDED', reason: '허위 리뷰', days: 7 });
    expect(toUserStatusRequest({ suspend: true, duration: '30', reason: '허위 리뷰' })).toEqual({ status: 'SUSPENDED', reason: '허위 리뷰', days: 30 });
    expect(toUserStatusRequest({ suspend: true, duration: 'permanent', reason: '결제 도용' })).toEqual({ status: 'SUSPENDED', reason: '결제 도용' });
  });

  it('해제: days 없이 사유만 (앞뒤 공백 제거)', () => {
    expect(toUserStatusRequest({ suspend: false, duration: '7', reason: '  소명 완료 ' })).toEqual({ status: 'ACTIVE', reason: '소명 완료' });
  });

  it('정지 기간 표시 — 종료 시각이 없으면 영구', () => {
    expect(suspensionLabel(null, String)).toBe('영구');
    expect(suspensionLabel('2026-10-29', (v) => v)).toBe('2026-10-29까지');
  });
});

function renderAdmin(path) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/users" element={<UserList />} />
          <Route path="/admin/users/:id" element={<UserDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('관리자 회원 화면 (admin API)', () => {
  beforeEach(() => {
    stubAdminApi();
  });

  it('목록 — 휴면 탭 · 주문 열 없음', async () => {
    renderAdmin('/admin/users');
    expect(await screen.findByRole('columnheader', { name: /누적 구매확정/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '주문' })).not.toBeInTheDocument();
    expect(screen.queryByText('휴면')).not.toBeInTheDocument();
  });

  it('정지 회원 상세 — 정지 기간 표시, 해제는 사유를 입력해야 확인', async () => {
    renderAdmin('/admin/users/11');
    expect(await screen.findByText('정지 기간')).toBeInTheDocument();
    expect(screen.queryByText('누적 주문')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '정지 해제' }));
    const confirm = screen.getByRole('button', { name: '확인' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('해제 사유'), { target: { value: '소명 완료' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('이용정지를 해제했어요'));
    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/admin/users/11/status', { status: 'ACTIVE', reason: '소명 완료' });
  });

  it('정상 회원 상세 — 기간 · 사유를 골라 정지', async () => {
    renderAdmin('/admin/users/4');
    expect(await screen.findByText('2026.10.20 · 린넨 셔츠')).toBeInTheDocument(); // 작성 리뷰 — review 회원별 목록
    expect(screen.getByText('사진과 달라요')).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/admin/users/4/reviews', { params: { size: 5 } });
    fireEvent.click(await screen.findByRole('button', { name: '이용 정지' }));
    fireEvent.change(screen.getByLabelText('정지 기간'), { target: { value: 'permanent' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('영구 이용정지했어요'));
    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/admin/users/4/status', expect.objectContaining({ status: 'SUSPENDED' }));
  });
});
