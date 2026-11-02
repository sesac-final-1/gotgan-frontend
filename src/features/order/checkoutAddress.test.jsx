import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import ShopCheckout from '@/features/order/components/ShopCheckout';

// 장바구니 · 포인트는 화면 바깥 — 주문서의 배송지 추가만 본다
vi.mock('@/features/order/hooks/useCart', () => ({
  useCart: () => ({
    isLoading: false,
    cart: {
      totalProductAmt: 9000, totalShippingFee: 0,
      stores: [{ storeId: 1, storeName: '곳간상회', shippingFee: 0, items: [
        { productOptionId: 11, checked: true, purchasable: true, productName: '제철 사과', optionName: null, quantity: 1, unitPrice: 9000, lineAmt: 9000, imageUrl: '' },
      ] }],
    },
  }),
}));
vi.mock('@/features/user/hooks/useMyPointsQuery', () => ({ useMyPointsQuery: () => ({ data: { balance: 0 } }) }));

const HOME = { id: 10, label: '집', name: '김곳간', phone: '010-1234-5678', zip: '06236', addr: '서울 강남구 테헤란로 152', detail: '21층', main: true };
const OFFICE = { id: 11, label: '회사', name: '박곳간', phone: '010-9999-0000', zip: '03187', addr: '서울 종로구 세종대로 175 (세종로)', detail: '3층', main: false };
const PICKED = { zonecode: '03187', userSelectedType: 'R', roadAddress: '서울 종로구 세종대로 175', jibunAddress: '', bname: '세종로', buildingName: '', apartment: 'N' };

let queryClient;
beforeEach(() => {
  window.kakao = { Postcode: class { constructor(o) { this.o = o; } embed() { this.o.oncomplete(PICKED); } } };
});
afterEach(async () => {
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  delete window.kakao;
  vi.restoreAllMocks();
});

function renderCheckout(lists) {
  const get = vi.spyOn(axiosInstance, 'get');
  lists.forEach((l) => get.mockResolvedValueOnce({ data: { data: l } }));
  get.mockResolvedValue({ data: { data: lists.at(-1) } });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(queryKeys.user.me(), { id: 4, name: '구매자1', phone: '010-0000-0004' });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/order']}>
        <Routes>
          <Route path="/order" element={<ShopCheckout />} />
          <Route path="/mypage/addresses" element={<p>마이페이지 배송지</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return get;
}

describe('주문서 배송지 추가', () => {
  it('배송지 선택에서 새 배송지 추가 — 주문서에서 바로 등록하고 새 배송지로 고른다', async () => {
    renderCheckout([[HOME], [HOME, OFFICE]]);
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: OFFICE } });
    expect(await screen.findByText('(06236) 서울 강남구 테헤란로 152 21층')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '변경' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 새 배송지 추가' }));

    expect(screen.getByLabelText('연락처')).toHaveValue('010-0000-0004'); // 회원정보 휴대폰으로 미리
    fireEvent.change(screen.getByLabelText('배송지 이름'), { target: { value: '회사' } });
    fireEvent.change(screen.getByLabelText('받는 분'), { target: { value: '박곳간' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '010-9999-0000' } });
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }));
    await waitFor(() => expect(screen.getByLabelText('우편번호')).toHaveValue('03187'));
    fireEvent.change(screen.getByLabelText('상세 주소'), { target: { value: '3층' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/users/me/addresses', expect.objectContaining({ label: '회사', zip: '03187' })));
    expect(await screen.findByText('(03187) 서울 종로구 세종대로 175 (세종로) 3층')).toBeInTheDocument(); // 새 배송지가 선택됨
    expect(screen.queryByText('마이페이지 배송지')).not.toBeInTheDocument();                           // 주문서에 그대로
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();                   // 폼이 닫힘
  });

  it('5개면 새 배송지 추가 비활성 · 안내', async () => {
    const five = [HOME, ...[1, 2, 3, 4].map((n) => ({ ...OFFICE, id: 20 + n, label: `주소${n}` }))];
    renderCheckout([five]);
    await screen.findByText('(06236) 서울 강남구 테헤란로 152 21층');

    fireEvent.click(screen.getByRole('button', { name: '변경' }));

    expect(screen.getByRole('button', { name: '+ 새 배송지 추가' })).toBeDisabled();
    expect(screen.getByText(/최대 5개까지 등록할 수 있어요\. 마이페이지에서/)).toBeInTheDocument();
  });
});
