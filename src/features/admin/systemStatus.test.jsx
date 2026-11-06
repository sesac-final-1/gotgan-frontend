import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchSystemEvents, fetchSystemMetrics, fetchSystemStatus, killService } from '@/features/admin/api/systemApi';
import { resetSystemMock } from '@/features/admin/api/systemMock';
import * as systemApi from '@/features/admin/api/systemApi';
import SystemDashboard from '@/features/admin/components/SystemDashboard';
import SystemFeaturePanel from '@/features/admin/components/SystemFeaturePanel';
import SystemServicePanel from '@/features/admin/components/SystemServicePanel';
import { formatErrorRate } from '@/features/admin/constants';

const T0 = new Date('2026-11-09T14:00:00+09:00');
const service = (status, name) => status.services.find((s) => s.name === name);
const feature = (status, key) => status.features.find((f) => f.key === key);
const after = (seconds) => vi.setSystemTime(new Date(T0.getTime() + seconds * 1000));

describe('시스템 상태 목', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    resetSystemMock();
  });
  afterEach(() => vi.useRealTimers());

  it('처음에는 모든 서비스 · 기능이 정상이다', async () => {
    const status = await fetchSystemStatus();
    expect(status.services.every((s) => s.state === 'UP' && s.ready === s.desired)).toBe(true);
    expect(status.features.every((f) => f.state === 'UP')).toBe(true);
  });

  it('레플리카 2 서비스를 1개 내리면 일부 상태이고 기능은 멈추지 않는다', async () => {
    await killService({ name: 'order-service', scope: 'ONE' });
    const status = await fetchSystemStatus();
    expect(service(status, 'order-service')).toMatchObject({ state: 'DEGRADED', ready: 1 });
    expect(feature(status, 'ORDER').state).toBe('UP');
  });

  it('전부 내리면 중단 → 복구 중 → 정상으로 바뀌고 타임라인에 복구 시간이 남는다', async () => {
    await killService({ name: 'order-service', scope: 'ALL' });
    expect(service(await fetchSystemStatus(), 'order-service').state).toBe('DOWN');
    expect((await fetchSystemEvents())[0]).toMatchObject({ service: 'order-service', recoveredAt: null });

    after(10);
    expect(service(await fetchSystemStatus(), 'order-service').state).toBe('RECOVERING');

    after(23);
    expect(service(await fetchSystemStatus(), 'order-service').state).toBe('UP');
    expect((await fetchSystemEvents())[0].recoverySeconds).toBe(23);
  });

  it('장애 영향표대로 기능이 멈춘다 — payment 는 주문만, store 는 장바구니까지', async () => {
    await killService({ name: 'payment-service', scope: 'ALL' });
    let status = await fetchSystemStatus();
    expect(feature(status, 'ORDER')).toMatchObject({ state: 'DOWN', causes: ['payment-service'] });
    expect(feature(status, 'CART').state).toBe('UP');
    expect(feature(status, 'BROWSE').state).toBe('UP');

    await killService({ name: 'store-service', scope: 'ALL' });
    status = await fetchSystemStatus();
    expect(feature(status, 'CART')).toMatchObject({ state: 'DOWN', causes: ['store-service'] });
  });

  it('내려간 서비스는 지표 오류율이 1, 나머지는 0 이다', async () => {
    await killService({ name: 'review-service', scope: 'ALL' });
    const { services } = await fetchSystemMetrics();
    expect(services.find((s) => s.name === 'review-service')).toMatchObject({ errorRate: 1, requestsPerSecond: 0 });
    expect(services.find((s) => s.name === 'order-service').errorRate).toBe(0);
  });

  it('내릴 수 없는 서비스는 400, 1분 안에 다시 내리면 409', async () => {
    await expect(killService({ name: 'gateway-service', scope: 'ALL' })).rejects.toMatchObject({ response: { status: 400, data: { code: 'SYSTEM_SERVICE_NOT_KILLABLE' } } });
    await killService({ name: 'chat-service', scope: 'ALL' });
    await expect(killService({ name: 'chat-service', scope: 'ALL' })).rejects.toMatchObject({ response: { status: 409, data: { code: 'SYSTEM_KILL_COOLDOWN' } } });
    after(60);
    await expect(killService({ name: 'chat-service', scope: 'ALL' })).resolves.toMatchObject({ deletedPods: ['chat-service-1'] });
  });

  it('레플리카 1 서비스는 1개를 골라도 전부 내린 것과 같다', async () => {
    await killService({ name: 'review-service', scope: 'ONE' });
    expect(service(await fetchSystemStatus(), 'review-service').state).toBe('DOWN');
  });
});

describe('시스템 상태 화면', () => {
  let queryClient;
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    vi.restoreAllMocks();
    resetSystemMock();
  });
  const renderPage = () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><SystemDashboard /></QueryClientProvider>);
  };

  it('받은 값이 없이 실패하면 다시 시도 안내를 보여 준다', async () => {
    vi.spyOn(systemApi, 'fetchSystemStatus').mockRejectedValue(new Error('503'));
    renderPage();
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  it('실패해도 마지막 값을 유지하고 연결 끊김을 표시한다', async () => {
    renderPage();
    expect(await screen.findByText('order')).toBeTruthy();
    vi.spyOn(systemApi, 'fetchSystemStatus').mockRejectedValue(new Error('503'));
    await act(() => queryClient.refetchQueries());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('연결 끊김'));
    expect(screen.getByText('order')).toBeTruthy();
  });
});

describe('서비스 상태 패널', () => {
  afterEach(cleanup);
  const svc = (name, state, ready, desired, killable = true) => ({ name, state, ready, desired, killable, pods: [] });

  it('상태 4가지를 글자로 보여 주고 파드 수를 알려 준다', () => {
    render(<SystemServicePanel services={[svc('order-service', 'UP', 2, 2), svc('payment-service', 'DEGRADED', 1, 2), svc('product-service', 'DOWN', 0, 2), svc('review-service', 'RECOVERING', 0, 1)]} />);
    for (const label of ['정상', '일부', '중단', '복구 중']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('img', { name: '파드 2개 중 1개 준비' }).textContent).toContain('1/2');
  });

  it('오류율은 퍼센트로, 값이 없으면 - 로 표시한다', () => {
    expect(formatErrorRate(0)).toBe('0%');
    expect(formatErrorRate(0.123)).toBe('12.3%');
    expect(formatErrorRate(1)).toBe('100%');
    expect(formatErrorRate(null)).toBe('-');
    render(<SystemServicePanel services={[svc('order-service', 'UP', 2, 2), svc('review-service', 'UP', 1, 1)]} metrics={{ services: [{ name: 'order-service', errorRate: 0.05 }, { name: 'review-service', errorRate: null }] }} />);
    expect(screen.getByText('오류 5%')).toBeTruthy();
    expect(screen.getByText('오류 -')).toBeTruthy();
  });

  it('내릴 수 없는 서비스는 아래로 보낸다', () => {
    render(<SystemServicePanel services={[svc('gateway-service', 'UP', 2, 2, false), svc('order-service', 'UP', 2, 2)]} />);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)[0]).toContain('order');
  });
});

describe('사용자 기능 패널', () => {
  afterEach(cleanup);

  it('멈춘 기능에 원인 서비스를 짧은 이름으로 함께 보여 주고 계산 값임을 알린다', () => {
    render(<SystemFeaturePanel features={[
      { key: 'BROWSE', label: '둘러보기 · 상품 상세', state: 'UP', causes: [] },
      { key: 'ORDER', label: '주문 · 결제', state: 'DOWN', causes: ['order-service', 'payment-service'] },
    ]} />);
    const [browse, order] = screen.getAllByRole('listitem');
    expect(browse.textContent).toContain('정상');
    expect(order.textContent).toContain('중단 · order, payment');
    expect(screen.getByText(/의존 관계로 계산/)).toBeTruthy();
  });

  it('서비스를 내리면 시스템 화면의 기능도 중단으로 바뀐다', async () => {
    resetSystemMock();
    await killService({ name: 'review-service', scope: 'ALL' });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><SystemDashboard /></QueryClientProvider>);
    const panel = await screen.findByRole('region', { name: '사용자 기능' });
    expect(within(panel).getByText('리뷰 보기').closest('li').textContent).toContain('중단 · review');
    expect(within(panel).getByText('장바구니').closest('li').textContent).toContain('정상');
    queryClient.clear();
    resetSystemMock();
  });
});
