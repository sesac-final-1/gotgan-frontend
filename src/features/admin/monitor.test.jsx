import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import {
  fetchMonitorCalls, fetchMonitorErrors, fetchMonitorOverview, fetchMonitorSummary, fetchMonitorTrace,
} from '@/features/admin/api/systemApi';
import SystemMonitorPanel from '@/features/admin/components/SystemMonitorPanel';
import SystemServicePanel from '@/features/admin/components/SystemServicePanel';
import { formatClock, hasErrors, isLatencySpike, isServerError, SCENARIO_SERVICES } from '@/features/admin/monitor';

// 실시간 모니터링 — 계약 backend admin.md 9절. 탭 · 이상 표시(빨간 배경 · 빨간 줄) · 트레이스 · 서비스 카드 색
const M = '/api/admin/system/monitor';
const pts = (...vs) => vs.map((v, i) => ({ t: i * 5000, v }));
const normal = { rps: pts(10, 12, 11), avgMs: pts(30, 32, 31), errorRate: pts(0, 0, 0) };
const failing = { rps: pts(10, 6, 5), avgMs: pts(30, 31, 2100), errorRate: pts(0, 0, 0.38) };

const overview = (product = normal) => ({
  serverTime: '2026-11-16T16:00:00+09:00',
  total: product === normal ? normal : failing,
  services: [
    { name: 'product-service', series: product, db: { active: 2, pending: 0, max: 20 } },
    { name: 'review-service', series: normal, db: { active: 1, pending: 0, max: 10 } },
    { name: 'chat-service', series: normal, db: null },
  ],
});

let state;
function stub() {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
    const data = {
      [`${M}/overview`]: state.overview,
      [`${M}/calls`]: [
        { traceId: 'aaa1', timestampMs: 1_700_000_000_123, method: 'GET', path: '/api/products/101', service: 'product-service', status: 502, durationMs: 4.2 },
        { traceId: 'bbb2', timestampMs: 1_700_000_000_100, method: 'GET', path: '/api/reviews', service: 'review-service', status: 200, durationMs: 12 },
      ],
      [`${M}/errors`]: [
        { kind: 'RESPONSE', timestampMs: 1_700_000_000_200, service: 'product-service', level: 'ERROR', title: 'GET /api/products/101', status: 502, traceId: 'aaa1' },
        { kind: 'LOG', timestampMs: 1_700_000_000_100, service: 'order-service', level: 'WARN', title: 'business exception - code=CART_ITEM_NOT_FOUND', status: null, traceId: null },
      ],
      [`${M}/summary`]: {
        topErrors: [{ service: 'product-service', api: '게이트웨이 라우트 product-service', status: '502', count: 40 }],
        slowest: [{ service: 'order-service', api: 'POST /api/orders', avgMs: 120 }],
        statuses: [{ status: '200', count: 900 }, { status: '502', count: 40 }],
      },
      [`${M}/traces/aaa1`]: {
        traceId: 'aaa1', durationMs: 10,
        spans: [
          { id: 'r', parentId: null, service: 'gateway-service', name: 'http get /api/products/101', kind: 'SERVER', startMs: 0, durationMs: 10, status: 502, error: true },
          { id: 'c', parentId: 'r', service: 'gateway-service', name: 'http get', kind: 'CLIENT', startMs: 2, durationMs: 4, status: 502, error: true },
        ],
      },
    }[url];
    return { data: { data } };
  });
}

describe('모니터링 규칙', () => {
  it('에러는 최근 3개 점 중 하나라도 0 보다 크면, 응답은 1초 초과 또는 중앙값 3배 + 200ms 초과면 이상', () => {
    expect(hasErrors(pts(0, 0, 0))).toBe(false);
    expect(hasErrors(pts(0.1, 0, 0, 0))).toBe(false);   // 오래된 점은 보지 않음
    expect(hasErrors(pts(0, 0.01, 0))).toBe(true);
    expect(hasErrors()).toBe(false);
    expect(isLatencySpike(pts(30, 31, 32, 1001))).toBe(true);
    expect(isLatencySpike(pts(30, 31, 32, 300))).toBe(true);
    expect(isLatencySpike(pts(30, 31, 32, 250))).toBe(false);
    expect(isLatencySpike(pts(30, 500))).toBe(false);   // 비교할 점이 부족
    expect(isLatencySpike([])).toBe(false);
    expect(isServerError(502)).toBe(true);
    expect(isServerError(404)).toBe(false);
    expect(isServerError(null)).toBe(false);
    expect(formatClock(new Date(2026, 10, 16, 9, 5, 7, 42).getTime())).toBe('09:05:07.042');
    expect(SCENARIO_SERVICES.CART).toContain('order-service');
  });

  it('API 경로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [] } });
    await fetchMonitorOverview();
    await fetchMonitorCalls();
    await fetchMonitorErrors();
    await fetchMonitorSummary();
    await fetchMonitorTrace('abc');
    expect(get.mock.calls.map((c) => c[0])).toEqual([`${M}/overview`, `${M}/calls`, `${M}/errors`, `${M}/summary`, `${M}/traces/abc`]);
    get.mockRestore();
  });
});

describe('실시간 모니터링 패널', () => {
  let queryClient;
  beforeEach(() => { state = { overview: overview() }; stub(); });
  afterEach(() => { cleanup(); queryClient?.clear(); vi.restoreAllMocks(); });
  const renderPanel = () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><SystemMonitorPanel /></QueryClientProvider>);
  };

  it('정상이면 빨간 배경이 없고, 에러 · 응답 급등이면 그래프와 서비스 칸에 표시한다', async () => {
    renderPanel();
    expect(await screen.findByText('3 / 30')).toBeTruthy();
    expect(document.querySelectorAll('[data-alert]').length).toBe(0);

    state.overview = overview(failing);
    await queryClient.refetchQueries();
    await waitFor(() => expect(screen.getByText('장애 감지')).toBeTruthy());
    expect(screen.getByRole('figure', { name: '에러율 (5xx)' }).dataset.alert).toBe('true');
    expect(screen.getByRole('figure', { name: '평균 응답' }).dataset.alert).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: '서비스별' }));
    const cards = within(screen.getByRole('list', { name: '서비스별 현황' }));
    expect(cards.getByText('product').className).toContain('text-rust');
    expect(cards.getByText('review').className).not.toContain('text-rust');
    expect(cards.getByText('DB 2/20')).toBeTruthy();
    expect(cards.getByText('DB 없음')).toBeTruthy();
  });

  it('호출 탭 — 5xx 줄은 빨간 줄, 누르면 트레이스 구간을 보여 준다', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: '호출' }));
    const rows = await screen.findAllByRole('row');
    const bad = rows.find((r) => r.textContent.includes('/api/products/101'));
    expect(bad.dataset.error).toBe('true');
    expect(rows.find((r) => r.textContent.includes('/api/reviews')).dataset.error).toBeUndefined();

    fireEvent.click(bad);
    expect(await screen.findByText('트레이스')).toBeTruthy();
    expect(await screen.findByText(/http get \/api\/products\/101/)).toBeTruthy();
    expect(screen.getByRole('list', { name: '구간' }).children).toHaveLength(2);
  });

  it('장애 탭 — 5xx 응답은 빨간 줄, WARN 로그는 일반, 분석 탭 — 에러 API · 느린 API · 상태 코드', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: '장애' }));
    const rows = await screen.findAllByRole('row');
    expect(rows.find((r) => r.textContent.includes('5xx 응답')).dataset.error).toBe('true');
    expect(rows.find((r) => r.textContent.includes('로그 WARN')).dataset.error).toBeUndefined();

    fireEvent.click(screen.getByRole('tab', { name: '분석' }));
    expect(await within(screen.getByRole('region', { name: '에러가 많은 API' })).findByText('40건')).toBeTruthy();
    expect(screen.getByText('120ms')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: '상태 코드 분포' })).getByText('900건')).toBeTruthy();
  });

  it('데이터가 없으면 안내한다', async () => {
    axiosInstance.get.mockResolvedValue({ data: { data: [] } });
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: '호출' }));
    expect(await screen.findByText('최근 1분 동안 들어온 요청이 없어요.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '장애' }));
    expect(await screen.findByText('최근 10분 동안 장애가 없어요.')).toBeTruthy();
  });
});

describe('서비스 카드 색 · 시나리오 강조', () => {
  afterEach(cleanup);
  const svc = (name, state, ready, desired) => ({ name, state, ready, desired, killable: true, pods: [] });

  it('다 준비되면 초록, 일부면 주황, 없으면 빨강 — 시나리오 서비스는 테두리 강조', () => {
    render(<SystemServicePanel chaosEnabled highlighted={['product-service']}
      services={[svc('product-service', 'UP', 2, 2), svc('order-service', 'RECOVERING', 1, 2), svc('review-service', 'DOWN', 0, 1)]} />);
    expect(screen.getByRole('img', { name: '파드 2개 중 2개 준비' }).dataset.tone).toBe('text-moss');
    expect(screen.getByRole('img', { name: '파드 2개 중 1개 준비' }).dataset.tone).toBe('text-amber');
    expect(screen.getByRole('img', { name: '파드 1개 중 0개 준비' }).dataset.tone).toBe('text-rust');
    const cards = screen.getByRole('list', { name: '내릴 수 있는 서비스' }).children;
    expect(cards[0].dataset.highlighted).toBe('true');
    expect(cards[1].dataset.highlighted).toBeUndefined();
  });
});
