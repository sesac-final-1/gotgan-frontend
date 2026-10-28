import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { useToastStore } from '@/shared/stores/toastStore';
import {
  createReview, deleteReview, fetchMyReviews, fetchWritableReviews, presignReviewImages, updateReview, uploadReviewImages,
} from '@/features/review/api/reviewApi';
import MyReviews from '@/features/review/components/MyReviews';

const NOW = new Date('2026-10-28T10:00:00+09:00');
const WRITABLE = {
  orderItemId: 11, productId: 101, productName: '린넨 오버핏 셔츠', optionName: '오트밀 / M', thumbnailUrl: 'https://cdn/p.jpg',
  confirmedAt: '2026-10-20T14:00:00+09:00', expiresAt: '2026-11-19T14:00:00+09:00',
};
const MINE = {
  reviewId: 31, orderItemId: 12, productId: 102, productName: '와이드 팬츠', optionName: null, thumbnailUrl: null,
  rating: 4, title: null, content: '기장이 살짝 길어서 수선했어요. 그 외에는 만족합니다.', fit: 'LARGE', blinded: false,
  replyContent: '감사합니다', repliedAt: '2026-10-21T09:30:00+09:00', createdAt: '2026-10-20T14:00:00+09:00',
  images: [{ key: 'reviews/4/a.jpg', url: 'https://cdn/reviews/4/a.jpg' }],
};
const BLINDED = { ...MINE, reviewId: 32, orderItemId: 13, productName: '린넨 셔츠', blinded: true, replyContent: null, images: [] };
const CONTENT = '평소 M 입는데 M 주문했고 어깨가 살짝 내려오는 오버핏이에요.';
const apiError = (status, code, message) =>
  new AxiosError(message, 'ERR', {}, null, { status, data: { code, message, data: null }, statusText: '', headers: {}, config: {} });
const jpg = (name = 'a.jpg', size = 1000) => new File([new Uint8Array(size)], name, { type: 'image/jpeg' });

let queryClient;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  URL.createObjectURL = vi.fn((f) => `blob:${f.name}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  useToastStore.setState({ current: null });
});

// GET — 작성 가능 · 내 리뷰를 URL 로 나눠 돌려준다 (다시 불러올 때 next 로 바꿈)
function renderMyReviews({ writable = [WRITABLE], mine = [MINE] } = {}) {
  const state = { writable, mine };
  const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({
    data: { data: url === '/api/reviews/me/writable' ? state.writable : { content: state.mine } },
  }));
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MyReviews /></QueryClientProvider>);
  return { get, state };
}

const openMine = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /내가 쓴 리뷰/ }));
};

describe('리뷰 API', () => {
  it('경로 · 응답을 화면 필드로', async () => {
    const get = vi.spyOn(axiosInstance, 'get')
      .mockResolvedValueOnce({ data: { data: { content: [MINE] } } })
      .mockResolvedValueOnce({ data: { data: [WRITABLE] } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { reviewId: 31 } } });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: { reviewId: 31 } } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });

    await expect(fetchMyReviews()).resolves.toEqual([expect.objectContaining({
      id: 31, lineId: 12, productName: '와이드 팬츠', option: '', thumbnail: null, title: '', body: MINE.content,
      fit: 'LARGE', reply: '감사합니다', date: new Date(MINE.createdAt), images: MINE.images,
    })]);
    expect(get).toHaveBeenNthCalledWith(1, '/api/reviews/me', { params: { page: 0, size: 50 } });
    await expect(fetchWritableReviews()).resolves.toEqual([{
      lineId: 11, productId: 101, productName: '린넨 오버핏 셔츠', option: '오트밀 / M', thumbnail: 'https://cdn/p.jpg',
      date: new Date(WRITABLE.confirmedAt), expiresAt: new Date(WRITABLE.expiresAt),
    }]);
    expect(get).toHaveBeenNthCalledWith(2, '/api/reviews/me/writable');
    await createReview({ orderItemId: 11 });
    expect(post).toHaveBeenCalledWith('/api/reviews', { orderItemId: 11 });
    await updateReview(31, { rating: 4 });
    expect(put).toHaveBeenCalledWith('/api/reviews/31', { rating: 4 });
    await deleteReview(31);
    expect(del).toHaveBeenCalledWith('/api/reviews/31');
  });

  it('사진 — presign 뒤 uploadUrl 로 PUT(Content-Type 같게), 키를 요청 순서대로', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [
      { key: 'reviews/4/1.jpg', uploadUrl: 'https://s3/1' }, { key: 'reviews/4/2.png', uploadUrl: 'https://s3/2' }] } });
    const put = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    const png = new File(['x'], 'b.png', { type: 'image/png' });

    await expect(uploadReviewImages([jpg(), png])).resolves.toEqual(['reviews/4/1.jpg', 'reviews/4/2.png']);
    expect(post).toHaveBeenCalledWith('/api/reviews/images/presign',
      { files: [{ contentType: 'image/jpeg', size: 1000 }, { contentType: 'image/png', size: 1 }] });
    expect(put).toHaveBeenCalledWith('https://s3/2', { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
    await expect(uploadReviewImages([])).resolves.toEqual([]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('사진 — S3 업로드가 실패하면 오류', async () => {
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [{ key: 'reviews/4/1.jpg', uploadUrl: 'https://s3/1' }] } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });

    await expect(uploadReviewImages([jpg()])).rejects.toThrow('사진을 올리지 못했어요');
    await expect(presignReviewImages([jpg()])).resolves.toHaveLength(1);
  });
});

describe('MyReviews', () => {
  it('작성 가능한 리뷰 — 상품 스냅샷 · 구매확정일 · 작성기한 D-day, 탭 숫자', async () => {
    renderMyReviews();
    expect(await screen.findByText('린넨 오버핏 셔츠')).toBeInTheDocument();
    expect(screen.getByText(/오트밀 \/ M · 2026.10.20 구매확정/)).toBeInTheDocument();
    expect(screen.getByText('작성기한 D-22')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /작성 가능한 리뷰 1/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /내가 쓴 리뷰 1/ })).toBeInTheDocument();
  });

  it('비어 있으면 안내', async () => {
    renderMyReviews({ writable: [], mine: [] });
    expect(await screen.findByText('작성 가능한 리뷰가 없어요')).toBeInTheDocument();
    await openMine();
    expect(screen.getByText('아직 쓴 리뷰가 없어요')).toBeInTheDocument();
  });

  it('내가 쓴 리뷰 — 사이즈 체감 · 사진 · 답글, 블라인드는 안내 · 수정 버튼 숨김', async () => {
    renderMyReviews({ mine: [MINE, BLINDED] });
    await openMine();
    const normal = (await screen.findByText('와이드 팬츠')).closest('li');
    expect(within(normal).getByText('· 사이즈 커요')).toBeInTheDocument();
    expect(within(normal).getByText('감사합니다')).toBeInTheDocument();
    expect(within(normal).getByRole('button', { name: '수정' })).toBeInTheDocument();
    const blinded = screen.getByText('린넨 셔츠').closest('li');
    expect(within(blinded).getByText(/관리자에 의해 블라인드 처리된 리뷰예요/)).toBeInTheDocument();
    expect(within(blinded).queryByRole('button', { name: '수정' })).toBeNull();
    expect(within(blinded).getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('삭제 — 확인 모달 뒤 DELETE, 목록 다시 불러옴', async () => {
    const { get, state } = renderMyReviews();
    const del = vi.spyOn(axiosInstance, 'delete').mockImplementation(async () => { state.mine = []; return { data: {} }; });
    await openMine();
    fireEvent.click(within((await screen.findByText('와이드 팬츠')).closest('li')).getByRole('button', { name: '삭제' }));
    expect(screen.getByText(/이 상품주문에는 다시 리뷰를 쓸 수 없어요/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('heading', { name: '리뷰 삭제' }).closest('div.w-full')).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/reviews/31'));
    expect(await screen.findByText('아직 쓴 리뷰가 없어요')).toBeInTheDocument();
    expect(useToastStore.getState().current).toMatchObject({ msg: '리뷰를 삭제했어요' });
    expect(get.mock.calls.filter(([url]) => url === '/api/reviews/me').length).toBeGreaterThan(1);
  });

  it('삭제 실패 — 서버 메시지 토스트', async () => {
    renderMyReviews();
    vi.spyOn(axiosInstance, 'delete').mockRejectedValue(apiError(404, 'REVIEW_NOT_FOUND', '리뷰를 찾을 수 없습니다.'));
    await openMine();
    fireEvent.click(within((await screen.findByText('와이드 팬츠')).closest('li')).getByRole('button', { name: '삭제' }));
    fireEvent.click(within(screen.getByRole('heading', { name: '리뷰 삭제' }).closest('div.w-full')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(useToastStore.getState().current).toMatchObject({ msg: '리뷰를 찾을 수 없습니다.' }));
  });
});

describe('MyReviewModal', () => {
  const openWrite = async () => {
    fireEvent.click(await screen.findByRole('button', { name: '리뷰 쓰기' }));
    return screen.getByRole('heading', { name: '리뷰 쓰기' }).closest('div.w-full');
  };

  it('작성 — 20자 미만은 막고, 별점 · 사이즈 체감 · 본문으로 POST, 작성 가능 · 내 리뷰를 다시 불러옴', async () => {
    const { get } = renderMyReviews();
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { reviewId: 40 } } });
    const modal = await openWrite();
    fireEvent.change(within(modal).getByLabelText('리뷰 내용'), { target: { value: '짧아요' } });
    fireEvent.click(within(modal).getByRole('button', { name: '등록하기' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('리뷰 내용은 20~2,000자로 입력해 주세요');
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(within(modal).getByRole('button', { name: '별점 4점' }));
    fireEvent.click(within(modal).getByRole('button', { name: '정사이즈' }));
    fireEvent.change(within(modal).getByLabelText('리뷰 내용'), { target: { value: `  ${CONTENT}  ` } });
    fireEvent.click(within(modal).getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/reviews', {
      orderItemId: 11, rating: 4, title: null, content: CONTENT, fit: 'TRUE_TO_SIZE', imageKeys: [],
    }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: '리뷰 쓰기' })).toBeNull());
    expect(useToastStore.getState().current).toMatchObject({ msg: '리뷰가 등록되었어요' });
    await waitFor(() => expect(get.mock.calls.filter(([url]) => url === '/api/reviews/me/writable').length).toBeGreaterThan(1));
  });

  it('작성 — 사진은 presign · PUT 뒤 imageKeys 로, 사이즈 체감은 다시 누르면 해제', async () => {
    renderMyReviews();
    const post = vi.spyOn(axiosInstance, 'post').mockImplementation(async (url) => ({ data: { data: url === '/api/reviews/images/presign'
      ? [{ key: 'reviews/4/n.jpg', uploadUrl: 'https://s3/n' }] : { reviewId: 40 } } }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    const modal = await openWrite();
    fireEvent.change(within(modal).getByLabelText('사진 추가'), { target: { files: [jpg('n.jpg')] } });
    expect(within(modal).getAllByRole('button', { name: '사진 빼기' })).toHaveLength(1);
    fireEvent.click(within(modal).getByRole('button', { name: '커요' }));
    fireEvent.click(within(modal).getByRole('button', { name: '커요' }));
    fireEvent.change(within(modal).getByLabelText('리뷰 내용'), { target: { value: CONTENT } });
    fireEvent.click(within(modal).getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/reviews', expect.objectContaining({ fit: null, imageKeys: ['reviews/4/n.jpg'] })));
  });

  it('사진 — 형식 · 10MB · 3장 초과는 막고, 3장이면 추가 칸이 사라진다', async () => {
    renderMyReviews();
    const modal = await openWrite();
    const input = () => within(modal).getByLabelText('사진 추가');
    fireEvent.change(input(), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } });
    expect(within(modal).getByRole('alert')).toHaveTextContent('JPG · PNG · WEBP 만');
    fireEvent.change(input(), { target: { files: [jpg('big.jpg', 10 * 1024 * 1024 + 1)] } });
    expect(within(modal).getByRole('alert')).toHaveTextContent('10MB 이하만');
    fireEvent.change(input(), { target: { files: [jpg('1.jpg'), jpg('2.jpg'), jpg('3.jpg'), jpg('4.jpg')] } });
    expect(within(modal).getByRole('alert')).toHaveTextContent('최대 3장');
    fireEvent.change(input(), { target: { files: [jpg('1.jpg'), jpg('2.jpg'), jpg('3.jpg')] } });
    expect(within(modal).queryByRole('alert')).toBeNull();
    expect(within(modal).queryByLabelText('사진 추가')).toBeNull();
    fireEvent.click(within(modal).getAllByRole('button', { name: '사진 빼기' })[0]);
    expect(within(modal).getByLabelText('사진 추가')).toBeInTheDocument();
  });

  it('수정 — 기존 값으로 열리고, 뺀 사진은 빼고 남긴 키로 PUT', async () => {
    renderMyReviews({ mine: [{ ...MINE, title: '한줄 요약' }] });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: { reviewId: 31 } } });
    await openMine();
    fireEvent.click(await screen.findByRole('button', { name: '수정' }));
    const modal = screen.getByRole('heading', { name: '리뷰 수정' }).closest('div.w-full');
    expect(within(modal).getByLabelText('리뷰 내용')).toHaveValue(MINE.content);
    fireEvent.click(within(modal).getByRole('button', { name: '사진 빼기' }));
    fireEvent.click(within(modal).getByRole('button', { name: '수정하기' }));

    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/reviews/31', {
      rating: 4, title: '한줄 요약', content: MINE.content, fit: 'LARGE', imageKeys: [],
    }));
    expect(useToastStore.getState().current).toMatchObject({ msg: '리뷰를 수정했어요' });
  });

  it('서버 오류 메시지는 모달 안에, 닫히지 않는다', async () => {
    renderMyReviews();
    vi.spyOn(axiosInstance, 'post').mockRejectedValue(apiError(409, 'REVIEW_WRITE_EXPIRED', '리뷰 작성 기한(구매확정 후 30일)이 지났습니다.'));
    const modal = await openWrite();
    fireEvent.change(within(modal).getByLabelText('리뷰 내용'), { target: { value: CONTENT } });
    fireEvent.click(within(modal).getByRole('button', { name: '등록하기' }));

    expect(await within(modal).findByRole('alert')).toHaveTextContent('리뷰 작성 기한(구매확정 후 30일)이 지났습니다.');
    expect(screen.getByRole('heading', { name: '리뷰 쓰기' })).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('heading', { name: '리뷰 쓰기' })).toBeNull();
  });
});

it('queryKeys — 내 리뷰 · 작성 가능은 my() 아래 (작성 · 수정 · 삭제 뒤 함께 무효화)', () => {
  expect(queryKeys.review.myList().slice(0, 2)).toEqual(queryKeys.review.my());
  expect(queryKeys.review.writable().slice(0, 2)).toEqual(queryKeys.review.my());
});
