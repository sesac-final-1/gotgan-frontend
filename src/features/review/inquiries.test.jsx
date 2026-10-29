import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useToastStore } from '@/shared/stores/toastStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { qnas as mockQnas } from '@/mocks/fixtures/reviews';
import {
  answerInquiry, createInquiry, deleteInquiry, fetchMyInquiries, fetchProductInquiries, fetchSellerInquiries,
  fetchSellerInquirySummary, updateInquiry,
} from '@/features/review/api/inquiryApi';
import ShopProductQna from '@/features/review/components/ShopProductQna';
import MyQna from '@/features/review/components/MyQna';
import SellerQnaList from '@/features/review/components/SellerQnaList';

const AT = '2026-10-29T10:00:00+09:00';
const OPEN = {
  inquiryId: 12, writerDisplayName: '곳간러버', secret: false, mine: true, content: '세탁기 사용 가능한가요?',
  answered: false, answerContent: null, answeredAt: null, createdAt: AT,
};
const SECRET = { ...OPEN, inquiryId: 13, writerDisplayName: '리넨좋아', secret: true, mine: false, content: null, answered: true };
const ANSWERED_MINE = { ...OPEN, inquiryId: 14, content: '재입고 언제 되나요?', answered: true, answerContent: '다음 주 예정입니다' };
const MINE = {
  inquiryId: 21, productId: 101, productName: '린넨 오버핏 셔츠', thumbnailUrl: 'https://cdn/p.jpg', content: '배송지 변경 가능할까요?',
  secret: true, answerContent: null, answeredAt: null, createdAt: AT,
};
const MINE_ANSWERED = { ...MINE, inquiryId: 22, secret: false, content: '세탁 방법이 궁금해요', answerContent: '찬물 단독세탁 추천드려요', answeredAt: AT };
const SELLER_ROW = {
  inquiryId: 31, productId: 101, productName: '린넨 오버핏 셔츠', writerDisplayName: '곳간러버', content: '배송지 변경 가능할까요?',
  secret: true, answerContent: null, answeredAt: null, createdAt: AT,
};
const SELLER_ANSWERED = { ...SELLER_ROW, inquiryId: 32, secret: false, content: '세탁 방법이 궁금해요', answerContent: '찬물 단독세탁 추천드려요' };
const SUMMARY = { unanswered: 1, answered: 1, all: 2 };
const page = (content, totalPages = 1) => ({ content, page: 0, size: 10, totalElements: content.length, totalPages, hasNext: false });
const apiError = (status, code, message) =>
  new AxiosError(message, 'ERR', {}, null, { status, data: { code, message, data: null }, statusText: '', headers: {}, config: {} });
const lastToast = () => useToastStore.getState().current?.msg;
const editModal = () => screen.getByRole('heading', { name: '문의 수정' }).closest('div.w-full');

let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
  useToastStore.setState({ current: null });
  useAuthStore.setState({ accessToken: null, user: null, isAuthReady: false });
});

function renderAt(element) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={element} />
          <Route path="/login" element={<p>로그인 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// GET 을 URL 로 나눠 돌려준다 — state 를 바꾸면 다시 불러올 때 반영
function mockGet(state) {
  return vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: state[url] } }));
}
const getParams = (get, url) => get.mock.calls.filter(([u]) => u === url).map(([, opts]) => opts?.params);

describe('상품 문의 API', () => {
  it('경로 · 요청 · 응답을 화면 필드로', async () => {
    const get = vi.spyOn(axiosInstance, 'get')
      .mockResolvedValueOnce({ data: { data: page([OPEN, SECRET]) } })
      .mockResolvedValueOnce({ data: { data: page([MINE_ANSWERED]) } })
      .mockResolvedValueOnce({ data: { data: page([SELLER_ROW]) } })
      .mockResolvedValueOnce({ data: { data: SUMMARY } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { inquiryId: 12 } } });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: { inquiryId: 12 } } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });

    const product = await fetchProductInquiries({ productId: 101, page: 0, size: 10 });
    expect(get).toHaveBeenNthCalledWith(1, '/api/inquiries', { params: { productId: 101, page: 0, size: 10 } });
    expect(product.content[0]).toEqual({
      id: 12, writer: '곳간러버', secret: false, mine: true, content: '세탁기 사용 가능한가요?', answered: false, answer: null, date: new Date(AT),
    });
    expect(product.content[1]).toMatchObject({ secret: true, content: null, answered: true });

    const mine = await fetchMyInquiries({ page: 0, size: 10 });
    expect(get).toHaveBeenNthCalledWith(2, '/api/inquiries/me', { params: { page: 0, size: 10 } });
    expect(mine.content[0]).toEqual({
      id: 22, productId: 101, productName: '린넨 오버핏 셔츠', thumbnail: 'https://cdn/p.jpg', content: '세탁 방법이 궁금해요', secret: false,
      answered: true, answer: '찬물 단독세탁 추천드려요', answeredAt: new Date(AT), date: new Date(AT),
    });

    const seller = await fetchSellerInquiries({ tab: 'UNANSWERED', page: 0, size: 10 });
    expect(get).toHaveBeenNthCalledWith(3, '/api/seller/inquiries', { params: { tab: 'UNANSWERED', page: 0, size: 10 } });
    expect(seller.content[0]).toEqual({
      id: 31, productId: 101, productName: '린넨 오버핏 셔츠', writer: '곳간러버', content: '배송지 변경 가능할까요?', secret: true,
      answer: null, date: new Date(AT),
    });
    await expect(fetchSellerInquirySummary()).resolves.toEqual(SUMMARY);
    expect(get).toHaveBeenNthCalledWith(4, '/api/seller/inquiries/summary');

    await createInquiry({ productId: 101, content: '문의', secret: true });
    expect(post).toHaveBeenCalledWith('/api/inquiries', { productId: 101, content: '문의', secret: true });
    await updateInquiry(12, { content: '수정', secret: false });
    expect(put).toHaveBeenCalledWith('/api/inquiries/12', { content: '수정', secret: false });
    await answerInquiry(31, '답변');
    expect(put).toHaveBeenCalledWith('/api/seller/inquiries/31/answer', { content: '답변' });
    await deleteInquiry(12);
    expect(del).toHaveBeenCalledWith('/api/inquiries/12');
  });

  it('목업 상품 id — API 를 부르지 않고 목업 문의를 같은 모양으로 (비밀글 가림 · 최신순 · 페이지)', async () => {
    const get = vi.spyOn(axiosInstance, 'get');
    const all = mockQnas.filter((q) => q.productId === 'p101');

    const result = await fetchProductInquiries({ productId: 'p101', page: 0, size: 2 });
    expect(result.totalElements).toBe(all.length);
    expect(result.content).toHaveLength(2);
    expect(result.content.map((q) => q.date.getTime())).toEqual([...result.content.map((q) => q.date.getTime())].sort((a, b) => b - a));
    const secret = (await fetchProductInquiries({ productId: 'p101' })).content.find((q) => q.secret);
    expect(secret).toMatchObject({ content: null, answer: null, writer: '구매자', mine: false });
    expect(get).not.toHaveBeenCalled();
  });
});

describe('상품 상세 Q&A', () => {
  it('목록 — 답변 상태 · 작성자, 볼 수 없는 비밀글은 가림, 내 문의만 수정(답변 전) · 삭제', async () => {
    mockGet({ '/api/inquiries': page([OPEN, SECRET, ANSWERED_MINE]) });
    renderAt(<ShopProductQna p={{ id: 101 }} />);

    expect(await screen.findByText('세탁기 사용 가능한가요?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Q&A 3' })).toBeInTheDocument();
    expect(screen.getByText('비밀글입니다.')).toBeInTheDocument();
    expect(screen.getByText('다음 주 예정입니다')).toBeInTheDocument();
    const openRow = screen.getByText('세탁기 사용 가능한가요?').closest('li');
    expect(within(openRow).getByRole('button', { name: '수정' })).toBeInTheDocument();
    const answeredRow = screen.getByText('재입고 언제 되나요?').closest('li');
    expect(within(answeredRow).queryByRole('button', { name: '수정' })).toBeNull();
    expect(within(answeredRow).getByRole('button', { name: '삭제' })).toBeInTheDocument();
    const secretRow = screen.getByText('비밀글입니다.').closest('li');
    expect(within(secretRow).queryByRole('button', { name: '삭제' })).toBeNull();
  });

  it('비로그인 문의하기 — 로그인 화면으로', async () => {
    mockGet({ '/api/inquiries': page([]) });
    renderAt(<ShopProductQna p={{ id: 101 }} />);
    expect(await screen.findByText('등록된 문의가 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));
    expect(await screen.findByText('로그인 화면')).toBeInTheDocument();
  });

  it('문의하기 — 빈 내용 막고, 공백 제거 · 비밀글로 POST, 목록 다시 불러옴', async () => {
    useAuthStore.setState({ accessToken: 'at', user: { userId: 4, roles: ['BUYER'] }, isAuthReady: true });
    const state = { '/api/inquiries': page([]) };
    const get = mockGet(state);
    const post = vi.spyOn(axiosInstance, 'post').mockImplementation(async () => {
      state['/api/inquiries'] = page([OPEN]);
      return { data: { data: { inquiryId: 12 } } };
    });
    renderAt(<ShopProductQna p={{ id: 101 }} />);
    await screen.findByText('등록된 문의가 없습니다.');

    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));
    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: '등록' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '  세탁기 사용 가능한가요?  ' } });
    fireEvent.click(screen.getByText(/비밀글로 문의하기/));
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/inquiries', { productId: 101, content: '세탁기 사용 가능한가요?', secret: true }));
    expect(await screen.findByText('세탁기 사용 가능한가요?')).toBeInTheDocument();
    expect(screen.queryByLabelText('내용')).toBeNull();
    expect(lastToast()).toMatch(/문의가 등록되었어요/);
    expect(getParams(get, '/api/inquiries').length).toBeGreaterThan(1);
  });

  it('수정 — 기존 값으로 열려 PUT, 삭제 — 확인 후 DELETE · 취소하면 그대로', async () => {
    useAuthStore.setState({ accessToken: 'at', user: { userId: 4, roles: ['BUYER'] }, isAuthReady: true });
    mockGet({ '/api/inquiries': page([OPEN]) });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: {} } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    renderAt(<ShopProductQna p={{ id: 101 }} />);
    const row = (await screen.findByText('세탁기 사용 가능한가요?')).closest('li');

    fireEvent.click(within(row).getByRole('button', { name: '수정' }));
    expect(screen.getByLabelText('내용')).toHaveValue('세탁기 사용 가능한가요?');
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '울코스로 세탁해도 되나요?' } });
    fireEvent.click(within(editModal()).getByRole('button', { name: '수정' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/inquiries/12', { content: '울코스로 세탁해도 되나요?', secret: false }));
    await waitFor(() => expect(lastToast()).toBe('문의를 수정했어요'));

    fireEvent.click(within(row).getByRole('button', { name: '삭제' }));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/inquiries/12'));
    await waitFor(() => expect(lastToast()).toBe('문의를 삭제했어요'));
  });

  it('삭제 실패 · 목록 오류 — 서버 메시지 토스트 · 안내', async () => {
    mockGet({ '/api/inquiries': page([OPEN]) });
    vi.spyOn(axiosInstance, 'delete').mockRejectedValue(apiError(404, 'INQUIRY_NOT_FOUND', '상품 문의를 찾을 수 없습니다.'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt(<ShopProductQna p={{ id: 101 }} />);
    fireEvent.click(within((await screen.findByText('세탁기 사용 가능한가요?')).closest('li')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(lastToast()).toBe('상품 문의를 찾을 수 없습니다.'));
    cleanup();

    vi.spyOn(axiosInstance, 'get').mockRejectedValue(new Error('500'));
    renderAt(<ShopProductQna p={{ id: 101 }} />);
    expect(await screen.findByText(/문의를 불러오지 못했어요/)).toBeInTheDocument();
  });
});

describe('마이페이지 내 문의', () => {
  it('목록 — 상품 · 비밀글 · 답변, 답변 전만 수정 · 빈 목록 안내', async () => {
    mockGet({ '/api/inquiries/me': page([MINE, MINE_ANSWERED]) });
    renderAt(<MyQna />);

    const open = (await screen.findByText('배송지 변경 가능할까요?')).closest('li');
    expect(within(open).getByText('린넨 오버핏 셔츠')).toBeInTheDocument();
    expect(within(open).getByText('비밀글')).toBeInTheDocument();
    expect(within(open).getByText('답변대기')).toBeInTheDocument();
    expect(within(open).getByRole('button', { name: '수정' })).toBeInTheDocument();
    const answered = screen.getByText('세탁 방법이 궁금해요').closest('li');
    expect(within(answered).getByText('찬물 단독세탁 추천드려요')).toBeInTheDocument();
    expect(within(answered).queryByRole('button', { name: '수정' })).toBeNull();
    cleanup();

    mockGet({ '/api/inquiries/me': page([]) });
    renderAt(<MyQna />);
    expect(await screen.findByText('작성한 문의가 없어요')).toBeInTheDocument();
  });

  it('수정 — 서버 409 는 모달 안에, 삭제 — 확인 모달 뒤 DELETE', async () => {
    mockGet({ '/api/inquiries/me': page([MINE]) });
    vi.spyOn(axiosInstance, 'put').mockRejectedValue(apiError(409, 'INQUIRY_ALREADY_ANSWERED', '판매자가 답변한 문의는 수정할 수 없습니다.'));
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });
    renderAt(<MyQna />);
    const row = (await screen.findByText('배송지 변경 가능할까요?')).closest('li');

    fireEvent.click(within(row).getByRole('button', { name: '수정' }));
    fireEvent.click(within(editModal()).getByRole('button', { name: '수정' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('판매자가 답변한 문의는 수정할 수 없습니다.');
    fireEvent.click(within(editModal()).getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: '삭제' }));
    const dialog = screen.getByRole('heading', { name: '문의 삭제' }).closest('div.w-full');
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/inquiries/21'));
    await waitFor(() => expect(lastToast()).toBe('문의를 삭제했어요'));
  });
});

describe('판매자 문의 관리', () => {
  it('탭 숫자 · 기본 미답변 · 탭 → 서버 tab, 비밀글 자물쇠 · 작성자', async () => {
    const get = mockGet({ '/api/seller/inquiries': page([SELLER_ROW]), '/api/seller/inquiries/summary': SUMMARY });
    renderAt(<SellerQnaList />);

    const row = (await screen.findByText('배송지 변경 가능할까요?')).closest('tr');
    expect(within(row).getByLabelText('비밀글')).toBeInTheDocument();
    expect(within(row).getByText('곳간러버')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /미답변/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /전체/ })).toHaveTextContent('2');
    expect(getParams(get, '/api/seller/inquiries')[0]).toEqual({ tab: 'UNANSWERED', page: 0, size: 10 });

    fireEvent.click(screen.getByRole('button', { name: /답변완료/ }));
    await waitFor(() => expect(getParams(get, '/api/seller/inquiries').at(-1)).toEqual({ tab: 'ANSWERED', page: 0, size: 10 }));
    fireEvent.click(screen.getByRole('button', { name: /전체/ }));
    await waitFor(() => expect(getParams(get, '/api/seller/inquiries').at(-1)).toMatchObject({ tab: 'ALL' }));
  });

  it('답변 등록 — 공백 막고 PUT, 다시 불러와 답변 표시', async () => {
    const state = { '/api/seller/inquiries': page([SELLER_ROW]), '/api/seller/inquiries/summary': SUMMARY };
    mockGet(state);
    const put = vi.spyOn(axiosInstance, 'put').mockImplementation(async () => {
      state['/api/seller/inquiries'] = page([{ ...SELLER_ROW, answerContent: '변경해 드렸습니다' }]);
      return { data: { data: {} } };
    });
    renderAt(<SellerQnaList />);
    const row = (await screen.findByText('배송지 변경 가능할까요?')).closest('tr');

    expect(within(row).getByRole('button', { name: '답변 등록' })).toBeDisabled();
    fireEvent.change(within(row).getByPlaceholderText('답변을 입력하세요'), { target: { value: '  변경해 드렸습니다 ' } });
    fireEvent.click(within(row).getByRole('button', { name: '답변 등록' }));

    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/seller/inquiries/31/answer', { content: '변경해 드렸습니다' }));
    expect(await screen.findByText('변경해 드렸습니다')).toBeInTheDocument();
    expect(lastToast()).toBe('답변을 등록했어요');
  });

  it('답변 수정 — 기존 답변으로 열림 · 취소 · 저장, 실패는 토스트', async () => {
    mockGet({ '/api/seller/inquiries': page([SELLER_ANSWERED]), '/api/seller/inquiries/summary': SUMMARY });
    const put = vi.spyOn(axiosInstance, 'put').mockRejectedValue(apiError(404, 'INQUIRY_NOT_FOUND', '상품 문의를 찾을 수 없습니다.'));
    renderAt(<SellerQnaList />);
    const row = (await screen.findByText('찬물 단독세탁 추천드려요')).closest('tr');

    fireEvent.click(within(row).getByRole('button', { name: '수정' }));
    expect(within(row).getByPlaceholderText('답변을 입력하세요')).toHaveValue('찬물 단독세탁 추천드려요');
    fireEvent.click(within(row).getByRole('button', { name: '취소' }));
    expect(within(row).queryByPlaceholderText('답변을 입력하세요')).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: '수정' }));
    fireEvent.change(within(row).getByPlaceholderText('답변을 입력하세요'), { target: { value: '찬물 단독세탁 · 그늘 건조 추천드려요' } });
    fireEvent.click(within(row).getByRole('button', { name: '답변 저장' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/seller/inquiries/32/answer', { content: '찬물 단독세탁 · 그늘 건조 추천드려요' }));
    await waitFor(() => expect(lastToast()).toBe('상품 문의를 찾을 수 없습니다.'));
    expect(within(row).getByPlaceholderText('답변을 입력하세요')).toHaveValue('찬물 단독세탁 · 그늘 건조 추천드려요');
  });
});
