import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import CategoryCommission from '@/features/admin/components/CategoryCommission';

// 카테고리 수수료 화면 — 상품 수는 product 카테고리 트리의 productCount(10/29 박지연님께 요청), 없으면 '-'. 스토어 수 칸은 없음
let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
});

function renderWith(tree) {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({
    data: { data: url === '/api/admin/categories' ? tree : [{ categoryId: 1, current: { rate: 7, effectiveFrom: '2026-10-01' }, reserved: [] }] },
  }));
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><CategoryCommission /></QueryClientProvider>);
}

describe('카테고리 수수료 — 상품 수', () => {
  it('상위 · 하위 상품 수를 카테고리 트리 값으로, 값이 없는 하위는 -, 스토어 칸 없음', async () => {
    renderWith([{ id: 1, name: '식품', nameEn: 'Food', sortOrder: 1, active: true, productCount: 12,
      children: [{ id: 101, name: '과일', productCount: 7 }, { id: 102, name: '채소' }] }]);

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /스토어/ })).not.toBeInTheDocument();
  });

  it('product 가 아직 상품 수를 주지 않으면 상위도 -', async () => {
    renderWith([{ id: 1, name: '식품', nameEn: 'Food', sortOrder: 1, active: true, children: [{ id: 101, name: '과일' }] }]);
    expect(await screen.findByText('식품')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
  });
});
