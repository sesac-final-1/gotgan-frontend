import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useToastStore } from '@/shared/stores/toastStore';
import { axiosInstance } from '@/shared/api/axiosInstance';
import StoreDetail from '@/features/admin/components/StoreDetail';
import ReportModeration from '@/features/admin/components/ReportModeration';

// 스토어 정지 · 해제 (backend #177 — store 9절 그대로) · 신고 상세의 리뷰 사진 (review #164)
let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
});

const store = (status) => ({ storeId: 1, storeName: '산골농부 박씨네', slug: 'park-farm', userId: 2, ownerName: '박영철', bizRegNo: '000-00-00006',
  grade: 'BIG_POWER', status, statusReason: null, createdAt: '2024-03-01T10:00:00+09:00' });

/** URL 별 응답 — 나머지(평점 · 카테고리 등)는 빈 배열 */
function stubGet(routes) {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: routes[url] ?? [] } }));
}

function renderAt(path) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/stores/:id" element={<StoreDetail />} />
          <Route path="/admin/reports" element={<ReportModeration />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('관리자 스토어 정지 · 해제', () => {
  it('정지 — 사유를 써야 변경 가능, PATCH 본문 {status, reason}, 끝나면 스토어 목록을 다시 불러온다', async () => {
    stubGet({ '/api/admin/stores': [store('ACTIVE')] });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { storeId: 1, status: 'SUSPENDED' } } });
    renderAt('/admin/stores/1');

    fireEvent.click(await screen.findByRole('button', { name: '상태 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '정지' }));
    expect(screen.getByRole('button', { name: '변경' })).toBeDisabled(); // 사유 없음
    fireEvent.change(screen.getByLabelText('사유 (스토어 이력에 기록)'), { target: { value: '  허위 광고 신고 3건  ' } });
    const listCalls = axiosInstance.get.mock.calls.filter(([url]) => url === '/api/admin/stores').length;
    fireEvent.click(screen.getByRole('button', { name: '변경' }));

    await waitFor(() => expect(useToastStore.getState().current.msg).toContain('스토어를 정지했어요'));
    expect(patch).toHaveBeenCalledWith('/api/admin/stores/1/status', { status: 'SUSPENDED', reason: '허위 광고 신고 3건' });
    await waitFor(() => expect(axiosInstance.get.mock.calls.filter(([url]) => url === '/api/admin/stores').length).toBeGreaterThan(listCalls));
  });

  it('실패하면 서버 메시지를 그대로 안내, 폐점 스토어는 상태 변경 버튼이 없다', async () => {
    stubGet({ '/api/admin/stores': [store('SUSPENDED')] });
    vi.spyOn(axiosInstance, 'patch').mockRejectedValue({ response: { data: { message: '폐점한 스토어는 상태를 바꿀 수 없습니다.' } } });
    renderAt('/admin/stores/1');

    fireEvent.click(await screen.findByRole('button', { name: '상태 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '운영중' }));
    fireEvent.change(screen.getByLabelText('사유 (스토어 이력에 기록)'), { target: { value: '소명 완료' } });
    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('폐점한 스토어는 상태를 바꿀 수 없습니다.'));
    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/admin/stores/1/status', { status: 'ACTIVE', reason: '소명 완료' });

    cleanup();
    stubGet({ '/api/admin/stores': [store('CLOSED')] });
    renderAt('/admin/stores/1');
    expect(await screen.findByRole('button', { name: '판매자와 상담' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '상태 변경' })).not.toBeInTheDocument();
  });
});

describe('신고 상세 — 리뷰 사진', () => {
  it('리뷰에 사진이 있으면 썸네일로 보여 주고 원본은 새 탭으로', async () => {
    stubGet({
      '/api/admin/reports': [{ targetType: 'REVIEW', targetId: 31, summary: '별로예요', reasonCounts: { ABUSE: 1 }, openCount: 1, totalCount: 1,
        lastReportedAt: '2026-10-29T10:00:00+09:00', lastAction: null }],
      '/api/admin/reports/REVIEW/31': { targetType: 'REVIEW', targetId: 31, actions: [],
        target: { reviewId: 31, content: '별로예요', rating: 1, productId: 101, blinded: false, imageUrls: ['https://img.example/r31-1.jpg'] },
        reports: [{ reportId: 1, status: 'OPEN', reasonCode: 'ABUSE', detail: null, reporterRole: 'BUYER', reporterId: 4, createdAt: '2026-10-29T10:00:00+09:00' }] },
    });
    renderAt('/admin/reports');

    fireEvent.click(await screen.findByRole('button', { name: '처리' }));
    const photo = await screen.findByRole('img', { name: '리뷰 사진' });
    expect(photo).toHaveAttribute('src', 'https://img.example/r31-1.jpg');
    expect(photo.closest('a')).toHaveAttribute('target', '_blank');
  });
});
