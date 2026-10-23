import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useToastStore } from '@/shared/stores/toastStore';
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
});

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

describe('관리자 회원 화면 (목업)', () => {
  it('목록 — 휴면 탭 · 주문 열 없음', async () => {
    renderAdmin('/admin/users');
    expect(await screen.findByRole('columnheader', { name: /누적 구매확정/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '주문' })).not.toBeInTheDocument();
    expect(screen.queryByText('휴면')).not.toBeInTheDocument();
  });

  it('정지 회원 상세 — 정지 기간 표시, 해제는 사유를 입력해야 확인', async () => {
    renderAdmin('/admin/users/u11');
    expect(await screen.findByText('정지 기간')).toBeInTheDocument();
    expect(screen.queryByText('누적 주문')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '정지 해제' }));
    const confirm = screen.getByRole('button', { name: '확인' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('해제 사유'), { target: { value: '소명 완료' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(useToastStore.getState().current.msg).toBe('이용정지를 해제했어요');
  });

  it('정상 회원 상세 — 기간 · 사유를 골라 정지', async () => {
    renderAdmin('/admin/users/u1');
    fireEvent.click(await screen.findByRole('button', { name: '이용 정지' }));
    fireEvent.change(screen.getByLabelText('정지 기간'), { target: { value: 'permanent' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(useToastStore.getState().current.msg).toBe('영구 이용정지했어요');
  });
});
