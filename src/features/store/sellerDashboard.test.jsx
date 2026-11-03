import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import SellerDashboard from '@/features/store/components/SellerDashboard';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const MY_STORE = { storeId: 1, storeName: '산골농부 박씨네', status: 'ACTIVE', ownerName: '박영철', grade: 'BIG_POWER' };
// backend store.md 15절 — 통계는 실제 값처럼, 날짜는 자정을 피한 고정값(CI 러너 UTC)
const DASH = {
  order: { storeId: 1, toConfirmCount: 2, toShipCount: 1, claimCount: 1, inProgressCount: 3, todaySalesAmt: 52000 },
  orderDaily: [{ date: '2026-10-29', tradeAmt: 40000, orderCount: 2 }, { date: '2026-10-30', tradeAmt: 26980, orderCount: 1 }],
  product: { onSaleCount: 5, lowStockCount: 1, soldOutCount: 0, stoppedCount: 2, lowStockProducts: [{ productId: 101, name: '서귀포 햇감귤', stock: 3, imageUrl: null }] },
  settlement: { pendingItemCount: 2, pendingPayoutAmt: 48000, nextPayout: { settlementId: 7, week: '2026-W44', payoutAmt: 345600, scheduledPayDate: '2026-11-05', status: 'SCHEDULED' }, recentPaid: [] },
  unavailable: [],
};
const ORDERS = {
  statusCounts: { PAYMENT_DONE: 2, PREPARING: 1, SHIPPING: 4, CANCEL_REQUESTED: 1 },
  items: { content: [{ orderItemId: 456, itemNo: '20261030-000001-01', productName: '지리산 꿀', buyerName: '곳*지', itemAmt: 48000, status: 'PAYMENT_DONE' }],
    page: 0, size: 6, totalElements: 1, totalPages: 1, hasNext: false },
};

function mockApi({ dash = DASH, store = MY_STORE } = {}) {
  return vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
    const data = {
      '/api/seller/store': store,
      '/api/seller/dashboard': dash,
      '/api/seller/order-items': ORDERS,
      '/api/seller/reviews/summary': { averageRating: 4.5, ratedCount: 12, distribution: [], products: [], tabCounts: { all: 12 } },
      '/api/seller/reviews': { content: [{ reviewId: 31, productId: 101, productName: '서귀포 햇감귤', writerDisplayName: '곳간러버', rating: 5, content: '달아요', blinded: false, replyContent: null,
        createdAt: '2026-10-30T14:00:00+09:00', imageUrls: [] }], page: 0, size: 3, totalPages: 1 },
      '/api/seller/inquiries/summary': { unanswered: 3, answered: 5, all: 8 },
    }[url];
    if (data === undefined) throw new Error(`unexpected GET ${url}`);
    return { data: { data } };
  });
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><SellerDashboard /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const tile = (label) => screen.getByText(label).closest('a');

describe('판매자 대시보드 — GET /api/seller/dashboard + 주문 · 리뷰 · 문의 API', () => {
  it('할 일은 주문 상태별 수 · 미답변 문의, 카드는 대시보드 통계, 최근 주문 · 새 리뷰 · 재고 부족', async () => {
    const get = mockApi();
    renderDashboard();

    expect(await screen.findByText('박영철 대표님, 좋은 하루예요')).toBeInTheDocument();
    expect(await screen.findByText('지리산 꿀')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/seller/order-items', { params: { page: 0, size: 6 } });
    expect(within(tile('신규주문')).getByText('2')).toBeInTheDocument();
    expect(within(tile('배송중')).getByText('4')).toBeInTheDocument();
    expect(within(tile('교환요청')).getByText('0')).toBeInTheDocument();
    expect(within(await screen.findByText('미답변 문의').then((el) => el.closest('a'))).getByText('3')).toBeInTheDocument();

    expect(screen.getByText('52,000')).toBeInTheDocument(); // 오늘 결제금액
    expect(screen.getByText('66,980')).toBeInTheDocument(); // 30일 합계
    expect(within(screen.getByText('다음 지급 예정').closest('.panel')).getByText('345,600')).toBeInTheDocument();
    expect(await screen.findByText('4.50')).toBeInTheDocument();
    expect(within(screen.getByText('상품 현황').closest('.panel')).getByText('5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /서귀포 햇감귤\s*3개/ })).toHaveAttribute('href', '/seller/products/101/edit');
    expect(await screen.findByText('달아요')).toBeInTheDocument();
    expect(screen.getByText(/이번 주 구매확정분 정산 예정 48,000원\(2건\)/)).toBeInTheDocument();
  });

  it('못 받은 영역(unavailable)은 그 카드만 안내 · 다음 지급 없음 · 30일 결제 없음', async () => {
    mockApi({ dash: { ...DASH, product: null, orderDaily: null, settlement: null, unavailable: ['orderDaily', 'product', 'settlement'] } });
    renderDashboard();

    await screen.findByText('박영철 대표님, 좋은 하루예요');
    expect(screen.getAllByText('일시적으로 불러올 수 없어요').length).toBeGreaterThanOrEqual(2); // 차트 · 상품 현황 (+ 정산 카드 부제)
    expect(screen.getByText('52,000')).toBeInTheDocument(); // 주문 영역은 정상
    cleanup();

    mockApi({ dash: { ...DASH, orderDaily: DASH.orderDaily.map((d) => ({ ...d, tradeAmt: 0 })), settlement: { ...DASH.settlement, nextPayout: null } } });
    renderDashboard();
    expect(await screen.findByText('최근 30일 결제가 없어요')).toBeInTheDocument();
    expect(screen.getByText('지급 예정 없음')).toBeInTheDocument();
  });

  it('정지 스토어는 배너', async () => {
    mockApi({ store: { ...MY_STORE, status: 'SUSPENDED', statusReason: '서류 확인 필요' } });
    renderDashboard();
    expect(await screen.findByText(/스토어가 정지 중이에요 — 상품이 쇼핑몰에 노출되지 않습니다 \(사유: 서류 확인 필요\)/)).toBeInTheDocument();
  });

  it('스토어나 통계 조회가 실패하면 \'불러오는 중\' 대신 다시 시도 안내, 누르면 실패한 것만 다시 요청', async () => {
    const get = mockApi();
    let failDash = true;
    const base = get.getMockImplementation();
    get.mockImplementation(async (url, config) => {
      if (url === '/api/seller/dashboard' && failDash) throw new Error('500');
      return base(url, config);
    });
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('대시보드를 불러오지 못했어요');
    expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument();

    failDash = false;
    const before = get.mock.calls.filter(([u]) => u === '/api/seller/store').length;
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('박영철 대표님, 좋은 하루예요')).toBeInTheDocument();
    expect(get.mock.calls.filter(([u]) => u === '/api/seller/store')).toHaveLength(before);
  });
});
