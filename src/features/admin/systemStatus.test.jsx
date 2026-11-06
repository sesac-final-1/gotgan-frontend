import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchSystemEvents, fetchSystemMetrics, fetchSystemStatus, killService } from '@/features/admin/api/systemApi';
import { resetSystemMock } from '@/features/admin/api/systemMock';
import * as systemApi from '@/features/admin/api/systemApi';
import SystemDashboard from '@/features/admin/components/SystemDashboard';
import SystemFeaturePanel from '@/features/admin/components/SystemFeaturePanel';
import SystemLinks from '@/features/admin/components/SystemLinks';
import SystemTimeline from '@/features/admin/components/SystemTimeline';
import SystemServicePanel from '@/features/admin/components/SystemServicePanel';
import { formatErrorRate } from '@/features/admin/constants';
import { useToastStore } from '@/shared/stores/toastStore';

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
    render(<SystemServicePanel chaosEnabled services={[svc('order-service', 'UP', 2, 2), svc('payment-service', 'DEGRADED', 1, 2), svc('product-service', 'DOWN', 0, 2), svc('review-service', 'RECOVERING', 0, 1)]} />);
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

  it('내릴 수 없는 서비스는 카드와 나눠 버튼 없이 보여 준다', () => {
    render(<SystemServicePanel chaosEnabled services={[svc('gateway-service', 'UP', 2, 2, false), svc('order-service', 'UP', 2, 2)]} />);
    expect(within(screen.getByRole('list', { name: '내릴 수 있는 서비스' })).getByText('order')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: '내릴 수 없는 서비스' })).getByText('gateway')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'gateway 내리기' })).toBeNull();
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

describe('서비스 내리기', () => {
  let queryClient;
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    vi.restoreAllMocks();
    resetSystemMock();
    useToastStore.setState({ current: null });
  });
  const renderPage = async () => {
    resetSystemMock();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><SystemDashboard /></QueryClientProvider>);
    await screen.findByRole('button', { name: 'order 내리기' });
  };
  const rowOf = (name) => within(screen.getByRole('region', { name: '서비스 상태' })).getByText(name).closest('li'); // 타임라인에도 같은 이름이 나온다
  const open = (name) => fireEvent.click(screen.getByRole('button', { name: `${name} 내리기` }));

  it('레플리카 2 서비스는 1개만 내릴 수 있고 바로 일부 상태로 바뀐다', async () => {
    await renderPage();
    open('order');
    fireEvent.click(screen.getByRole('button', { name: '1개만 내리기' }));
    await waitFor(() => expect(rowOf('order').textContent).toContain('일부'));
    expect(rowOf('order').textContent).toContain('1/2');
    expect(useToastStore.getState().current.msg).toContain('order 파드 1개');
    expect(screen.queryByRole('button', { name: '1개만 내리기' })).toBeNull();
    expect(screen.getByRole('button', { name: 'order 내리기' }).disabled).toBe(true);
  });

  it('전부 내리면 중단으로 바뀌고 기능도 멈춘다', async () => {
    await renderPage();
    open('order');
    fireEvent.click(screen.getByRole('button', { name: '전부 내리기' }));
    await waitFor(() => expect(rowOf('order').textContent).toContain('중단'));
    expect(screen.getByText('주문 · 결제').closest('li').textContent).toContain('중단 · order');
  });

  it('레플리카 1 서비스는 1개 선택 없이 내리기만 있다', async () => {
    await renderPage();
    open('review');
    expect(screen.queryByRole('button', { name: '1개만 내리기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '내리기' }));
    await waitFor(() => expect(rowOf('review').textContent).toContain('중단'));
  });

  it('취소하면 내리지 않는다', async () => {
    await renderPage();
    open('order');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(rowOf('order').textContent).toContain('정상');
    expect(screen.queryByRole('button', { name: '전부 내리기' })).toBeNull();
  });

  it('서버가 거절하면 그 메시지를 보여 준다', async () => {
    await renderPage();
    vi.spyOn(systemApi, 'killService').mockRejectedValue({ response: { data: { message: '방금 내린 서비스입니다.' } } });
    open('order');
    fireEvent.click(screen.getByRole('button', { name: '전부 내리기' }));
    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('방금 내린 서비스입니다.'));
    expect(rowOf('order').textContent).toContain('정상');
  });

  it('내리기가 꺼져 있으면 버튼을 막고 안내한다 · gateway 는 내릴 수 없다', async () => {
    const status = await systemApi.fetchSystemStatus();
    vi.spyOn(systemApi, 'fetchSystemStatus').mockResolvedValue({ ...status, chaosEnabled: false });
    await renderPage();
    expect(screen.getByRole('button', { name: 'order 내리기' }).disabled).toBe(true);
    expect(screen.getByText(/내리기 기능이 꺼져/)).toBeTruthy();
    expect(screen.getByText('내릴 수 없음')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'gateway 내리기' })).toBeNull();
  });
});

describe('타임라인 · 바로가기', () => {
  let queryClient;
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    vi.restoreAllMocks();
  });
  const renderTimeline = (events) => {
    vi.spyOn(systemApi, 'fetchSystemEvents').mockImplementation(events);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><SystemTimeline /></QueryClientProvider>);
  };

  it('내린 시각 · 복구 시각 · 걸린 시간을 서울 시각으로 보여 준다', async () => {
    renderTimeline(async () => [
      { eventId: '2', service: 'review-service', scope: 'ALL', killedAt: '2026-11-09T05:10:00Z', recoveredAt: null, recoverySeconds: null },
      { eventId: '1', service: 'order-service', scope: 'ONE', killedAt: '2026-11-09T05:03:11Z', recoveredAt: '2026-11-09T05:04:02Z', recoverySeconds: 51 },
    ]);
    const rows = await screen.findAllByRole('listitem');
    expect(rows[0].textContent).toContain('review');
    expect(rows[0].textContent).toContain('복구 기다리는 중');
    expect(rows[1].textContent).toContain('14:03:11');
    expect(rows[1].textContent).toContain('1개 내림');
    expect(rows[1].textContent).toContain('14:04:02 복구 · 51초');
  });

  it('없으면 빈 안내, 실패하면 실패 안내를 보여 준다', async () => {
    renderTimeline(async () => []);
    expect(await screen.findByText('아직 내린 서비스가 없어요.')).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();
    renderTimeline(async () => { throw new Error('503'); });
    expect(await screen.findByText('타임라인을 불러오지 못했어요.')).toBeTruthy();
  });

  it('쇼핑몰은 새 창으로 열고 Grafana 는 접속 명령을 안내한다', () => {
    render(<SystemLinks />);
    const shop = screen.getByRole('link', { name: /쇼핑몰 새 창으로 열기/ });
    expect(shop.getAttribute('target')).toBe('_blank');
    expect(shop.getAttribute('rel')).toContain('noopener');
    fireEvent.click(screen.getByRole('button', { name: 'Grafana 안내' }));
    expect(screen.getByText(/port-forward svc\/grafana 3000/)).toBeTruthy();
  });
});
