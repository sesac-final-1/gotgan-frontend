import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { reviews as mockReviews } from '@/mocks/fixtures/reviews';
import { fetchProductReviewSummary, fetchProductReviews } from '@/features/review/api/reviewApi';
import ShopProductReviews from '@/features/review/components/ShopProductReviews';

const REVIEW = {
  reviewId: 31, writerDisplayName: '곳간러버', rating: 5, title: '핏이 진짜 예뻐요', content: '평소 M 입는데 M 주문했어요.',
  optionName: '오트밀 / M', fit: 'TRUE_TO_SIZE', replyContent: '소중한 후기 감사합니다.', repliedAt: '2026-10-21T09:30:00+09:00',
  createdAt: '2026-10-20T14:00:00+09:00', imageUrls: ['https://cdn/reviews/1/a.jpg', 'https://cdn/reviews/1/b.jpg'],
};
const PLAIN = { ...REVIEW, reviewId: 32, writerDisplayName: '리넨좋아', title: null, content: '그냥 그래요', optionName: null, fit: null, replyContent: null, imageUrls: [] };
const SUMMARY = {
  averageRating: 4.5, reviewCount: 2,
  distribution: [{ rating: 5, count: 1 }, { rating: 4, count: 1 }, { rating: 3, count: 0 }, { rating: 2, count: 0 }, { rating: 1, count: 0 }],
  fits: [{ fit: 'SMALL', count: 0 }, { fit: 'TRUE_TO_SIZE', count: 1 }, { fit: 'LARGE', count: 0 }],
};
const page = (content, totalPages = 1) => ({ content, page: 0, size: 10, totalElements: content.length, totalPages, hasNext: false });
const P = { id: '101', cat: 'fashion' };
const STORE = { name: '오롯이 리넨' };

let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
});

// GET — 요약 · 포토 줄(photoOnly) · 목록을 URL · 파라미터로 나눠 돌려준다
function renderReviews({ list = [REVIEW, PLAIN], photo = [REVIEW], totalPages = 1, p = P, fail = false } = {}) {
  const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url, { params }) => {
    if (fail && url === '/api/reviews') throw new Error('500');
    if (url === '/api/reviews/summary') return { data: { data: SUMMARY } };
    const isPhotoStrip = !('rating' in params);
    return { data: { data: isPhotoStrip && photo ? page(photo) : page(list, totalPages) } };
  });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><ShopProductReviews p={p} store={STORE} /></QueryClientProvider>);
  return get;
}
// 목록 호출만 — 포토 줄 호출에는 rating 키가 없다
const lastListParams = (get) => get.mock.calls.filter(([url, opts]) => url === '/api/reviews' && 'rating' in opts.params).at(-1)[1].params;

describe('상품 리뷰 API', () => {
  it('숫자 상품 id — 실제 API 경로 · 응답을 화면 필드로', async () => {
    const get = vi.spyOn(axiosInstance, 'get')
      .mockResolvedValueOnce({ data: { data: page([REVIEW, PLAIN]) } })
      .mockResolvedValueOnce({ data: { data: SUMMARY } });
    const params = { productId: 101, rating: 5, photoOnly: true, sort: 'RATING_HIGH', page: 0, size: 10 };

    const result = await fetchProductReviews(params);
    expect(get).toHaveBeenNthCalledWith(1, '/api/reviews', { params });
    expect(result.totalPages).toBe(1);
    expect(result.content[0]).toEqual({
      id: 31, writer: '곳간러버', rating: 5, title: '핏이 진짜 예뻐요', body: REVIEW.content, option: '오트밀 / M', fit: 'TRUE_TO_SIZE',
      reply: '소중한 후기 감사합니다.', date: new Date(REVIEW.createdAt), photos: REVIEW.imageUrls,
    });
    expect(result.content[1]).toMatchObject({ title: '', option: '', fit: null, reply: null, photos: [] });

    await expect(fetchProductReviewSummary(101)).resolves.toEqual(SUMMARY);
    expect(get).toHaveBeenNthCalledWith(2, '/api/reviews/summary', { params: { productId: 101 } });
  });

  it('목업 상품 id — API 를 부르지 않고 목업 리뷰를 같은 모양으로 (블라인드 제외 · 필터 · 정렬 · 페이지)', async () => {
    const get = vi.spyOn(axiosInstance, 'get');
    const visible = mockReviews.filter((r) => r.productId === 'p101' && !r.blinded);

    const all = await fetchProductReviews({ productId: 'p101', page: 0, size: 3 });
    expect(all.totalElements).toBe(visible.length);
    expect(all.content).toHaveLength(3);
    expect(all.content[0]).toMatchObject({ writer: '구매자', photos: expect.any(Array) });
    expect(all.content[0].date).toBeInstanceOf(Date);
    expect(['SMALL', 'TRUE_TO_SIZE', 'LARGE']).toContain(all.content[0].fit);

    const low = await fetchProductReviews({ productId: 'p101', sort: 'RATING_LOW', page: 0, size: 50 });
    expect(low.content.map((r) => r.rating)).toEqual([...low.content.map((r) => r.rating)].sort((a, b) => a - b));
    const photo = await fetchProductReviews({ productId: 'p101', photoOnly: true, rating: 5 });
    expect(photo.content.every((r) => r.photos.length > 0 && r.rating === 5)).toBe(true);

    const summary = await fetchProductReviewSummary('p101');
    expect(summary.reviewCount).toBe(visible.length);
    expect(summary.distribution.map((d) => d.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(summary.fits.map((f) => f.fit)).toEqual(['SMALL', 'TRUE_TO_SIZE', 'LARGE']);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('상품 상세 리뷰 영역', () => {
  it('요약 · 사이즈 · 포토 줄 · 목록(작성자 · 옵션 · 사이즈 · 사진 · 판매자 답글), 도움돼요 없음', async () => {
    renderReviews();
    expect(await screen.findByText('곳간러버', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '리뷰 2' })).toBeInTheDocument();
    expect(await screen.findByText('포토 리뷰')).toBeInTheDocument();
    expect(screen.getAllByText('정사이즈').length).toBeGreaterThan(0);
    expect(screen.getByText(/옵션: 오트밀 \/ M/)).toBeInTheDocument();
    expect(screen.getByText('핏이 진짜 예뻐요')).toBeInTheDocument();
    expect(screen.getByText('소중한 후기 감사합니다.')).toBeInTheDocument();
    expect(screen.getByText('오롯이 리넨')).toBeInTheDocument();
    expect(screen.queryByText(/도움/)).toBeNull();
  });

  it('별점 · 포토만 · 정렬 · 페이지 → 서버 파라미터, 바꾸면 1페이지로', async () => {
    const get = renderReviews({ totalPages: 3 });
    await screen.findByText('그냥 그래요');
    expect(lastListParams(get)).toEqual({ productId: '101', rating: undefined, photoOnly: false, sort: 'LATEST', page: 0, size: 10 });

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(lastListParams(get)).toMatchObject({ page: 1 }));

    fireEvent.click(screen.getByRole('button', { name: /^4점/ }));
    await waitFor(() => expect(lastListParams(get)).toMatchObject({ rating: 4, page: 0 }));
    fireEvent.click(screen.getByRole('button', { name: '4점만' }));
    await waitFor(() => expect(lastListParams(get)).toMatchObject({ rating: undefined }));

    fireEvent.click(screen.getByRole('button', { name: '평점 낮은순' }));
    await waitFor(() => expect(lastListParams(get)).toMatchObject({ sort: 'RATING_LOW' }));

    fireEvent.click(screen.getByText('포토 리뷰만'));
    await waitFor(() => expect(lastListParams(get)).toMatchObject({ photoOnly: true, sort: 'RATING_LOW' }));
  });

  it('빈 목록 · 조건 빈 목록 · 오류 안내, 패션이 아니면 사이즈 대신 구매자 한마디', async () => {
    renderReviews({ list: [], photo: [], p: { id: '101', cat: 'food' } });
    expect(await screen.findByText('아직 작성된 리뷰가 없어요')).toBeInTheDocument();
    expect(screen.getByText('구매자 한마디')).toBeInTheDocument();
    expect(screen.queryByText('포토 리뷰')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^5점/ }));
    expect(await screen.findByText('조건에 맞는 리뷰가 없어요')).toBeInTheDocument();
    cleanup();

    renderReviews({ fail: true });
    expect(await screen.findByText(/리뷰를 불러오지 못했어요/)).toBeInTheDocument();
  });
});
