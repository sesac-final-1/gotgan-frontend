import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import SellerDashboard from '@/features/store/components/SellerDashboard';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// backend GET /api/seller/settlements — { summary, settlements }
const settlementsResponse = (nextPayout) => ({
  summary: { nextPayout, paidRecent8WeeksAmt: 0, pendingPayoutAmt: 12000, appliedRates: [] },
  settlements: [],
});

// 정산 API 만 응답을 정하고, 나머지(아직 목업인 스토어 · 일별 매출 등)는 그대로 둔다
function mockApi(nextPayout) {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
    if (url === '/api/seller/settlements') return { data: { data: settlementsResponse(nextPayout) } };
    if (url === '/api/categories') return { data: { data: [] } };
    throw new Error(`unexpected GET ${url}`);
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

describe('판매자 대시보드 — 정산 응답 { summary, rows }', () => {
  it('다음 지급이 있으면 금액 · 지급일을 보여 준다', async () => {
    mockApi({ payoutAmt: 345600, scheduledPayDate: '2026-10-29', week: '2026-W43' });
    renderDashboard();

    const card = (await screen.findByText('다음 지급 예정')).closest('.panel');
    expect(within(card).getByText('345,600')).toBeInTheDocument();
    // 지급일 숫자는 실행 환경 시간대에 따라 하루 달라질 수 있어(KST 자정) 날짜 자리만 확인
    expect(within(card).getByText(/\d{2} 지급$/)).toBeInTheDocument();
  });

  it('정산서가 없는 신규 판매자도 대시보드를 그린다 (정산 칸만 비움)', async () => {
    mockApi(null);
    renderDashboard();

    expect(await screen.findByText('다음 지급 예정')).toBeInTheDocument();
    expect(screen.getByText('지급 예정 없음')).toBeInTheDocument();
    expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument();
  });
});
