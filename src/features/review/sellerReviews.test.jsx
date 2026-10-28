import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useToastStore } from '@/shared/stores/toastStore';
import { fetchSellerReviewSummary, fetchSellerReviews, replyToReview } from '@/features/review/api/reviewApi';
import SellerReviewList from '@/features/review/components/SellerReviewList';

const REVIEW = {
  reviewId: 31, productId: 101, productName: '린넨 오버핏 셔츠', optionName: '오트밀 / M', writerDisplayName: '곳간러버',
  rating: 2, title: '길이가 조금 길어요', content: '키 160인데 기장이 살짝 길어서 수선했어요.', fit: 'LARGE', blinded: false,
  replyContent: null, repliedAt: null, createdAt: '2026-10-20T14:00:00+09:00', imageUrls: ['https://cdn/reviews/1/a.jpg'],
};
const REPLIED = { ...REVIEW, reviewId: 32, rating: 5, title: null, content: '아주 좋아요 재구매 의사 있어요', optionName: null, replyContent: '감사합니다', imageUrls: [] };
const BLINDED = { ...REVIEW, reviewId: 33, content: '광고 리뷰', blinded: true, imageUrls: [] };
const SUMMARY = {
  averageRating: 3.5, ratedCount: 2,
  distribution: [{ rating: 5, count: 1 }, { rating: 4, count: 0 }, { rating: 3, count: 0 }, { rating: 2, count: 1 }, { rating: 1, count: 0 }],
  products: [{ productId: 101, productName: '린넨 오버핏 셔츠', averageRating: 3.5, count: 2 }],
  tabCounts: { all: 3, noReply: 1, lowRating: 2, photo: 1 },
};
const REASON = '예: 상품과 무관한 광고성 내용';
const apiError = (status, code, message) =>
  new AxiosError(message, 'ERR', {}, null, { status, data: { code, message, data: null }, statusText: '', headers: {}, config: {} });

let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
  useToastStore.setState({ current: null });
});

// GET — 요약 · 목록을 URL 로 나눠 돌려준다 (다시 불러올 때 state 를 바꿈)
function renderList({ reviews = [REVIEW, REPLIED, BLINDED], totalPages = 1 } = {}) {
  const state = { reviews };
  const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({
    data: { data: url === '/api/seller/reviews/summary' ? SUMMARY : { content: state.reviews, totalPages } },
  }));
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><SellerReviewList /></QueryClientProvider>);
  return { get, state };
}
const listCalls = (get) => get.mock.calls.filter(([url]) => url === '/api/seller/reviews').map(([, opts]) => opts.params);
const rowOf = async (text) => (await screen.findByText(text)).closest('tr');

describe('판매자 리뷰 API', () => {
  it('경로 · 응답을 화면 필드로', async () => {
    const get = vi.spyOn(axiosInstance, 'get')
      .mockResolvedValueOnce({ data: { data: { content: [REVIEW, REPLIED], totalPages: 1 } } })
      .mockResolvedValueOnce({ data: { data: SUMMARY } });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: { reviewId: 31, replyContent: '죄송합니다' } } });

    const page = await fetchSellerReviews({ tab: 'ALL', page: 0, size: 10 });
    expect(page.totalPages).toBe(1);
    expect(page.content[0]).toEqual({
      id: 31, productId: 101, productName: '린넨 오버핏 셔츠', option: '오트밀 / M', writer: '곳간러버', rating: 2,
      title: '길이가 조금 길어요', body: REVIEW.content, fit: 'LARGE', blinded: false, reply: null,
      date: new Date(REVIEW.createdAt), photos: ['https://cdn/reviews/1/a.jpg'],
    });
    expect(page.content[1]).toMatchObject({ option: '', title: '', reply: '감사합니다', photos: [] });
    expect(get).toHaveBeenNthCalledWith(1, '/api/seller/reviews', { params: { tab: 'ALL', page: 0, size: 10 } });

    await expect(fetchSellerReviewSummary()).resolves.toEqual(SUMMARY);
    expect(get).toHaveBeenNthCalledWith(2, '/api/seller/reviews/summary');

    await expect(replyToReview(31, '죄송합니다')).resolves.toMatchObject({ replyContent: '죄송합니다' });
    expect(put).toHaveBeenCalledWith('/api/seller/reviews/31/reply', { content: '죄송합니다' });
  });
});

describe('판매자 리뷰 관리 화면', () => {
  it('요약 — 평균 · 분포 · 상품별 평균 · 탭 숫자', async () => {
    renderList();
    expect(await screen.findByText('3.50')).toBeInTheDocument();
    expect(screen.getByText('★ 3.50')).toBeInTheDocument();
    expect(screen.getByText('2건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /답글 미작성/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /포토/ })).toHaveTextContent('1');
    expect(within(screen.getByRole('combobox', { name: '상품' })).getByRole('option', { name: '린넨 오버핏 셔츠' })).toHaveValue('101');
  });

  it('목록 — 작성자 · 옵션 · 사진 · 답글, 블라인드는 검토 요청 · 답글 막음', async () => {
    renderList();
    const row = await rowOf('키 160인데 기장이 살짝 길어서 수선했어요.');
    expect(within(row).getByText('곳간러버')).toBeInTheDocument();
    expect(within(row).getByText('오트밀 / M')).toBeInTheDocument();
    expect(row.querySelector('img')).toHaveAttribute('src', 'https://cdn/reviews/1/a.jpg');
    expect(within(row).getByText('2026.10.20')).toBeInTheDocument();

    const replied = await rowOf('아주 좋아요 재구매 의사 있어요');
    expect(within(replied).getByText('감사합니다')).toBeInTheDocument();

    const blinded = await rowOf('광고 리뷰');
    expect(within(blinded).getByText('블라인드')).toBeInTheDocument();
    expect(within(blinded).queryByRole('button', { name: '관리자 검토 요청' })).toBeNull();
    expect(within(blinded).getByText('블라인드된 리뷰에는 답글을 달 수 없어요')).toBeInTheDocument();
  });

  it('탭 · 상품 · 페이지 → 서버 파라미터, 탭 · 상품을 바꾸면 1페이지로', async () => {
    const { get } = renderList({ totalPages: 3 });
    await screen.findByText('광고 리뷰');
    expect(listCalls(get)[0]).toEqual({ tab: 'ALL', productId: undefined, page: 0, size: 10 });

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(listCalls(get).at(-1)).toMatchObject({ page: 1 }));

    fireEvent.click(screen.getByRole('button', { name: /1~2점/ }));
    await waitFor(() => expect(listCalls(get).at(-1)).toEqual({ tab: 'LOW_RATING', productId: undefined, page: 0, size: 10 }));

    fireEvent.click(screen.getByRole('button', { name: /포토/ }));
    await waitFor(() => expect(listCalls(get).at(-1)).toMatchObject({ tab: 'PHOTO' }));

    fireEvent.click(screen.getByRole('button', { name: /답글 미작성/ }));
    fireEvent.change(screen.getByRole('combobox', { name: '상품' }), { target: { value: '101' } });
    await waitFor(() => expect(listCalls(get).at(-1)).toEqual({ tab: 'NO_REPLY', productId: '101', page: 0, size: 10 }));
  });

  it('답글 작성 — 자주 쓰는 답글 · 공백 제거 PUT → 목록 다시 불러옴', async () => {
    const { get, state } = renderList();
    const put = vi.spyOn(axiosInstance, 'put').mockImplementation(async () => {
      state.reviews = [{ ...REVIEW, replyContent: '불편을 드려 죄송합니다. 말씀해주신 부분 꼭 개선하겠습니다.' }];
      return { data: { data: {} } };
    });
    const row = await rowOf('키 160인데 기장이 살짝 길어서 수선했어요.');
    expect(within(row).getByRole('button', { name: '등록' })).toBeDisabled();
    fireEvent.change(within(row).getByRole('textbox'), { target: { value: '   ' } });
    expect(within(row).getByRole('button', { name: '등록' })).toBeDisabled();
    fireEvent.click(within(row).getByRole('button', { name: '자주 쓰는 답글' }));
    const before = get.mock.calls.length;
    fireEvent.click(within(row).getByRole('button', { name: '등록' }));

    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/seller/reviews/31/reply', { content: '불편을 드려 죄송합니다. 말씀해주신 부분 꼭 개선하겠습니다.' }));
    expect(await screen.findByText('내 답글')).toBeInTheDocument();
    expect(get.mock.calls.length).toBeGreaterThan(before); // 목록 · 요약 무효화
    expect(useToastStore.getState().current.msg).toBe('답글을 등록했어요');
  });

  it('답글 수정 — 기존 답글로 열림 · 취소 · 4점 이상 자주 쓰는 답글 · 저장', async () => {
    renderList();
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: {} } });
    const row = await rowOf('아주 좋아요 재구매 의사 있어요');
    fireEvent.click(within(row).getByRole('button', { name: '수정' }));
    expect(within(row).getByRole('textbox')).toHaveValue('감사합니다');
    fireEvent.click(within(row).getByRole('button', { name: '취소' }));
    expect(within(row).queryByRole('textbox')).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: '수정' }));
    fireEvent.click(within(row).getByRole('button', { name: '자주 쓰는 답글' }));
    fireEvent.click(within(row).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/seller/reviews/32/reply', { content: '소중한 후기 감사합니다! 다음에도 만족하실 수 있도록 준비하겠습니다.' }));
  });

  it('답글 실패 — 서버 메시지 토스트, 입력은 그대로', async () => {
    renderList();
    vi.spyOn(axiosInstance, 'put').mockRejectedValue(apiError(409, 'REVIEW_BLINDED', '블라인드된 리뷰에는 답글을 달 수 없어요'));
    const row = await rowOf('키 160인데 기장이 살짝 길어서 수선했어요.');
    fireEvent.change(within(row).getByRole('textbox'), { target: { value: '확인했습니다' } });
    fireEvent.click(within(row).getByRole('button', { name: '등록' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('블라인드된 리뷰에는 답글을 달 수 없어요'));
    expect(within(row).getByRole('textbox')).toHaveValue('확인했습니다');
  });

  it('관리자 검토 요청 — 사유 필수 · SELLER_REQUEST 신고 → 검토 요청됨', async () => {
    renderList();
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { reportId: 9 } } });
    const row = await rowOf('키 160인데 기장이 살짝 길어서 수선했어요.');
    fireEvent.click(within(row).getByRole('button', { name: '관리자 검토 요청' }));
    const dialog = (await screen.findByPlaceholderText(REASON)).closest('.bg-white'); // Modal 본문 상자
    expect(within(dialog).getByRole('button', { name: '요청' })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: ' 광고성 내용 ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '요청' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/reports', { targetType: 'REVIEW', targetId: 31, reasonCode: 'SELLER_REQUEST', detail: '광고성 내용' }));
    expect(await within(row).findByText('검토 요청됨')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(REASON)).toBeNull();
    expect(useToastStore.getState().current.msg).toMatch(/검토 요청을 보냈어요/);
  });

  it('검토 요청 실패 — 서버 메시지를 모달 안에 · 취소로 닫기', async () => {
    renderList();
    vi.spyOn(axiosInstance, 'post').mockRejectedValue(apiError(409, 'REPORT_DUPLICATED', '이미 신고한 대상이에요'));
    const row = await rowOf('키 160인데 기장이 살짝 길어서 수선했어요.');
    fireEvent.click(within(row).getByRole('button', { name: '관리자 검토 요청' }));
    const dialog = (await screen.findByPlaceholderText(REASON)).closest('.bg-white'); // Modal 본문 상자
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '광고' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '요청' }));
    expect(await within(dialog).findByText('이미 신고한 대상이에요')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(screen.queryByPlaceholderText(REASON)).toBeNull();
    expect(within(row).getByRole('button', { name: '관리자 검토 요청' })).toBeInTheDocument();
  });
});
