import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import MyOrderDetail from '@/features/order/components/MyOrderDetail';
import ReportModal from '@/features/report/components/ReportModal';

// 다른 화면의 채팅 진입 버튼 — 어떤 방 · 문맥 카드로 여는지 (chat.md "문맥 카드")
const ROOM = { roomId: 21, type: 'BUYER_SUPPORT', status: 'OPEN', counterpart: { name: '곳간 운영팀', role: 'ADMIN' }, lastMessage: null, unreadCount: 0 };

const ORDER = {
  orderNo: '20261027-000001', status: 'PAID', orderedAt: '2026-10-27T10:00:00', paidAt: '2026-10-27T10:01:00',
  receiverName: '김서연', receiverPhone: '010-0000-0000', zipcode: '04524', address1: '서울 중구 세종대로 110', address2: null, deliveryMemo: null,
  totalProductAmt: 30000, totalShippingFee: 0, usedPoint: 0, payAmt: 30000, earnedPoint: 1500, payment: { method: 'CARD' },
  items: [{
    orderItemId: 456, storeId: 3, storeName: '오롯이 리넨', productName: '리넨 셔츠', optionName: '오트밀 / M', thumbnailUrl: null,
    quantity: 1, itemAmt: 30000, status: 'PAYMENT_DONE', trackingNo: null,
  }],
};

let post;
beforeEach(() => {
  useAuthStore.setState({ accessToken: 't', user: { userId: 10, name: '김서연', roles: ['BUYER'] }, isAuthReady: true });
  vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: ORDER } });
  post = vi.spyOn(axiosInstance, 'post').mockImplementation(async (url) => ({
    data: { data: url === '/api/reports' ? { reportId: 77, status: 'OPEN' } : ROOM },
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderAt(path, routePath, element) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/mypage/chats/:roomId" element={<p>구매자 채팅방</p>} />
          <Route path="/seller/chats/:roomId" element={<p>판매자 채팅방</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('주문 상세 진입 버튼', () => {
  it('상품마다 판매자 문의 — 그 스토어 스토어 톡에 상품주문 카드', async () => {
    renderAt('/mypage/orders/20261027-000001', '/mypage/orders/:id', <MyOrderDetail />);
    fireEvent.click(await screen.findByText('판매자 문의'));
    expect(await screen.findByText('구매자 채팅방')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/api/chats/rooms', { type: 'STORE_INQUIRY', storeId: 3, context: { type: 'ORDER_ITEM', id: 456 } });
  });

  it('결제 · 환불 문의 — 고객센터 상담에 주문 카드(id = 주문번호의 숫자)', async () => {
    renderAt('/mypage/orders/20261027-000001', '/mypage/orders/:id', <MyOrderDetail />);
    fireEvent.click(await screen.findByText('결제 · 환불 문의'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/chats/rooms',
      { type: 'BUYER_SUPPORT', context: { type: 'ORDER', id: 20261027000001 } }));
  });
});

describe('신고 접수 후 처리 문의', () => {
  const target = { type: 'REVIEW', id: 31, label: '리뷰' };

  it('접수하면 완료 안내로 바뀌고, 처리 문의는 고객센터 상담에 신고 카드', async () => {
    const onClose = vi.fn();
    renderAt('/products/101', '/products/:id', <ReportModal target={target} onClose={onClose} />);
    fireEvent.click(screen.getByText('신고하기'));
    expect(await screen.findByText('신고 접수 완료')).toBeInTheDocument();
    fireEvent.click(screen.getByText('운영팀에 처리 문의'));
    expect(await screen.findByText('구매자 채팅방')).toBeInTheDocument();
    expect(post).toHaveBeenLastCalledWith('/api/chats/rooms', { type: 'BUYER_SUPPORT', context: { type: 'REPORT', id: 77 } });
  });

  it('판매자센터에서 신고했으면 판매자 운영 상담으로 · 닫기는 그냥 닫음', async () => {
    const onClose = vi.fn();
    renderAt('/seller/reviews', '/seller/reviews', <ReportModal target={target} onClose={onClose} />);
    fireEvent.click(screen.getByText('신고하기'));
    fireEvent.click(await screen.findByText('운영팀에 처리 문의'));
    expect(await screen.findByText('판매자 채팅방')).toBeInTheDocument();
    expect(post).toHaveBeenLastCalledWith('/api/chats/rooms', { type: 'SELLER_SUPPORT', context: { type: 'REPORT', id: 77 } });
  });

  it('완료 안내의 닫기', async () => {
    const onClose = vi.fn();
    renderAt('/products/101', '/products/:id', <ReportModal target={target} onClose={onClose} />);
    fireEvent.click(screen.getByText('신고하기'));
    fireEvent.click(await screen.findByText('닫기'));
    expect(onClose).toHaveBeenCalled();
  });
});
