import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useRatedProducts } from '@/features/product/hooks/useRatedProducts';
import ProductCard from '@/features/product/components/ProductCard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
    expect(result.current[0].rated).toBe(true);
    expect(result.current[1]).toBe(PRODUCTS[1]);
  });
});

describe('ProductCard — 별점 표시', () => {
  const CARD = { id: 101, name: '서귀포 햇감귤', status: '판매중', images: ['/a.jpg'], tags: [], price: 1000, discount: 0, salePrice: 1000, rating: 0, reviews: 0 };
  const renderCard = (p) => render(<MemoryRouter><ProductCard p={p} showStore={false} /></MemoryRouter>);

  it('평점을 못 받은 상품(review 장애)은 별점을 보여 주지 않음', () => {
    // when
    renderCard(CARD);

    // then — 「★ 0.0 (0)」 이면 리뷰가 없는 상품처럼 보인다
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('평점을 받았으면 리뷰가 0개여도 그대로 표시', () => {
    // when
    renderCard({ ...CARD, rated: true });

    // then
    expect(screen.getByText('★ 0.0')).toBeTruthy();
    expect(screen.getByText('(0)')).toBeTruthy();
  });
});
