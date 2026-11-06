import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useProductReviewsQuery } from '@/features/review/hooks/useProductReviews';
import { useProductInquiriesQuery } from '@/features/review/hooks/useInquiries';

// 새로고침 — 로그인 복구 전에 토큰 없이 받은 mine:false 를 복구 뒤 다시 받는다 (QA 2차 N-경-1)
const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe('상품 상세 리뷰 · 문의 — 보는 사람이 바뀌면 다시 받기', () => {
  afterEach(() => { act(() => useAuthStore.getState().clearAuth()); vi.restoreAllMocks(); });

  it.each([
    ['리뷰', () => useProductReviewsQuery({ productId: 1, page: 0, size: 10 })],
    ['문의', () => useProductInquiriesQuery(1, 0)],
  ])('%s — 로그인이 복구되면 한 번 더 조회한다', async (_name, useTarget) => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { content: [], totalElements: 0, totalPages: 0, number: 0 } } });
    const { result } = renderHook(useTarget, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);

    act(() => useAuthStore.getState().setAuth({ accessToken: 't', user: { userId: 4, name: '시험', roles: [] } }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
