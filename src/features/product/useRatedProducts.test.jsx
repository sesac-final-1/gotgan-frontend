import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useRatedProducts } from '@/features/product/hooks/useRatedProducts';

afterEach(() => vi.restoreAllMocks());

const PRODUCTS = [{ id: 101, name: '서귀포 햇감귤', rating: 0, reviews: 0 }, { id: 102, name: '지리산 꿀', rating: 0, reviews: 0 }];

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useRatedProducts — 상품 카드에 별점 · 리뷰 수', () => {
  it('평점을 받기 전에는 다시 렌더해도 같은 목록(새 배열을 만들지 않음)', () => {
    // given — 평점 응답이 오지 않는 동안
    vi.spyOn(axiosInstance, 'get').mockReturnValue(new Promise(() => {}));
    const { result, rerender } = renderHook(() => useRatedProducts(PRODUCTS), { wrapper });

    // when
    const first = result.current;
    rerender();

    // then — 렌더마다 새 배열이면 표(useClientTable)가 매번 다시 계산된다
    expect(result.current).toBe(first);
  });

  it('평점을 받으면 해당 상품에만 별점 · 리뷰 수를 붙임', async () => {
    // given
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [{ productId: 101, averageRating: 4.5, reviewCount: 12 }] } });

    // when
    const { result } = renderHook(() => useRatedProducts(PRODUCTS), { wrapper });

    // then
    await waitFor(() => expect(result.current[0].rating).toBe(4.5));
    expect(result.current[0].reviews).toBe(12);
    expect(result.current[1]).toBe(PRODUCTS[1]);
  });
});
