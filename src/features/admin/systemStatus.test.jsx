import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchSystemEvents, fetchSystemMetrics, fetchSystemStatus, killOneEach, killService } from '@/features/admin/api/systemApi';
import SystemDashboard from '@/features/admin/components/SystemDashboard';
import SystemFeaturePanel from '@/features/admin/components/SystemFeaturePanel';
import SystemScenarioPanel from '@/features/admin/components/SystemScenarioPanel';
import SystemLinks from '@/features/admin/components/SystemLinks';
import SystemServicePanel from '@/features/admin/components/SystemServicePanel';
import SystemTimeline from '@/features/admin/components/SystemTimeline';
import { formatErrorRate } from '@/features/admin/constants';
import { useToastStore } from '@/shared/stores/toastStore';

// 장애 시연 화면 — 계약 backend admin.md 7절. 서버를 흉내 내는 작은 상태 하나로 내리기 흐름까지 확인한다
const BASE = '/api/admin/system';
const svcOf = (name, desired, killable = true) => ({ name, killable, desired, ready: desired, state: 'UP', pods: [] });
let server;

function resetServer({ chaosEnabled = true } = {}) {
  server = {
    chaosEnabled,
    services: [svcOf('order-service', 2), svcOf('review-service', 1), svcOf('gateway-service', 2, false)],
    features: [
      { key: 'CART_ORDER', label: '장바구니 · 주문', state: 'UP', causes: [] },
      { key: 'REVIEW', label: '리뷰 · 문의', state: 'UP', causes: [] },
    ],
  };
}

function stubServer() {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
    if (url === `${BASE}/status`) return { data: { data: { chaosEnabled: server.chaosEnabled, serverTime: '2026-11-09T14:00:00+09:00', services: server.services, features: server.features } } };
    if (url === `${BASE}/metrics`) return { data: { data: { services: server.services.map((s) => ({ name: s.name, requestsPerSecond: 1, errorRate: s.ready ? 0 : 1 })) } } };
    return { data: { data: [] } };
  });
  vi.spyOn(axiosInstance, 'post').mockImplementation(async (url, { scope }) => {
    const name = url.split('/').at(-2);
    const svc = server.services.find((s) => s.name === name);
    const one = scope === 'ONE' && svc.desired > 1;
    Object.assign(svc, one ? { ready: svc.desired - 1, state: 'RECOVERING' } : { ready: 0, state: 'DOWN' });
    if (name === 'order-service' && !one) server.features[0] = { ...server.features[0], state: 'DOWN', causes: [name] };
    if (name === 'review-service') server.features[1] = { ...server.features[1], state: 'DOWN', causes: [name] };
    return { data: { data: { eventId: 1, deletedPods: Array.from({ length: one ? 1 : svc.desired }, (_, i) => `${name}-${i}`) } } };
  });
}

describe('시스템 상태 API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('조회는 봉투를 벗겨 그대로 돌려준다', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: { url } } }));
    await expect(fetchSystemStatus()).resolves.toEqual({ url: `${BASE}/status` });
    await expect(fetchSystemMetrics()).resolves.toEqual({ url: `${BASE}/metrics` });
    await expect(fetchSystemEvents()).resolves.toEqual({ url: `${BASE}/events` });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('내리기는 서비스 이름 경로로 범위를 보낸다', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { eventId: 12, deletedPods: ['order-service-a'] } } });
    await expect(killService({ name: 'order-service', scope: 'ONE' })).resolves.toEqual({ eventId: 12, deletedPods: ['order-service-a'] });
    expect(post).toHaveBeenCalledWith(`${BASE}/services/order-service/kill`, { scope: 'ONE', reason: undefined });
  });

  it('시나리오는 본문 없이 보내고 사유가 있으면 함께 보낸다', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { services: [{ service: 'order-service', eventId: 31, deletedPods: ['o-1'] }] } } });
    await expect(killOneEach()).resolves.toEqual({ services: [{ service: 'order-service', eventId: 31, deletedPods: ['o-1'] }] });
    expect(post).toHaveBeenLastCalledWith(`${BASE}/scenarios/kill-one-each`, {});
    await killOneEach({ reason: '리허설' });
    expect(post).toHaveBeenLastCalledWith(`${BASE}/scenarios/kill-one-each`, { reason: '리허설' });
  });
});

describe('시스템 상태 화면', () => {
  let queryClient;
  beforeEach(() => { resetServer(); stubServer(); });
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    vi.restoreAllMocks();
  });
  const renderPage = () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><SystemDashboard /></QueryClientProvider>);
  };

  it('받은 값이 없이 실패하면 다시 시도 안내를 보여 준다', async () => {
    axiosInstance.get.mockRejectedValue(new Error('503'));
    renderPage();
    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  it('실패해도 마지막 값을 유지하고 연결 끊김을 표시한다', async () => {
    renderPage();
    const cards = () => within(screen.getByRole('list', { name: '내릴 수 있는 서비스' }));
    await waitFor(() => expect(cards().getByText('order')).toBeTruthy());
    axiosInstance.get.mockRejectedValue(new Error('503'));
    await act(() => queryClient.refetchQueries());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('연결 끊김'));
    expect(cards().getByText('order')).toBeTruthy();
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
    const [browse, order] = within(screen.getAllByRole('list').at(-1)).getAllByRole('listitem');
    expect(browse.textContent).toContain('정상');
    expect(order.textContent).toContain('중단 · order, payment');
    expect(screen.getByText(/의존 관계로 계산/)).toBeTruthy();
    const legend = screen.getByRole('list', { name: '상태 설명' }).textContent;
    for (const word of ['정상', '일부 동작', '중단']) expect(legend).toContain(word);
  });

  it('일부 장애(DEGRADED)도 원인과 함께 표시한다', () => {
    render(<SystemFeaturePanel features={[{ key: 'CART_ORDER', label: '장바구니 · 주문', state: 'DEGRADED', causes: ['order-service'] }]} />);
    expect(screen.getByText('장바구니 · 주문').closest('li').textContent).toContain('일부 · order');
  });
});

describe('서비스 내리기', () => {
  let queryClient;
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    vi.restoreAllMocks();
    useToastStore.setState({ current: null });
  });
  beforeEach(() => { resetServer(); stubServer(); });
  const renderPage = async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><SystemDashboard /></QueryClientProvider>);
    await screen.findByRole('button', { name: 'order 내리기' });
  };
  const rowOf = (name) => within(screen.getByRole('region', { name: '서비스 상태' })).getByText(name).closest('li'); // 타임라인에도 같은 이름이 나온다
  const open = (name) => fireEvent.click(screen.getByRole('button', { name: `${name} 내리기` }));

  it('레플리카 2 서비스는 1개만 내릴 수 있고 바로 복구 중으로 바뀐다', async () => {
    await renderPage();
    open('order');
    fireEvent.click(screen.getByRole('button', { name: '1개만 내리기' }));
    await waitFor(() => expect(rowOf('order').textContent).toContain('복구 중'));
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
    expect(screen.getByText('장바구니 · 주문').closest('li').textContent).toContain('중단 · order');
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
    axiosInstance.post.mockRejectedValue({ response: { data: { message: '방금 내린 서비스입니다.' } } });
    open('order');
    fireEvent.click(screen.getByRole('button', { name: '전부 내리기' }));
    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('방금 내린 서비스입니다.'));
    expect(rowOf('order').textContent).toContain('정상');
  });

  it('내리기가 꺼져 있으면 버튼을 막고 안내한다 · gateway 는 내릴 수 없다', async () => {
    resetServer({ chaosEnabled: false });
    await renderPage();
    expect(screen.getByRole('button', { name: 'order 내리기' }).disabled).toBe(true);
    expect(within(screen.getByRole('region', { name: '서비스 상태' })).getByText(/내리기 기능이 꺼져/)).toBeTruthy();
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
    vi.spyOn(axiosInstance, 'get').mockImplementation(async () => ({ data: { data: await events() } }));
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

describe('시나리오 — 레플리카 2 서비스 1개씩 내리기', () => {
  let queryClient;
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    vi.restoreAllMocks();
    useToastStore.setState({ current: null });
  });
  const svc = (name, desired, state = 'UP', killable = true) => ({ name, killable, desired, ready: desired, state, pods: [] });
  const SERVICES = [svc('order-service', 2), svc('user-service', 2), svc('review-service', 1), svc('gateway-service', 2, 'UP', false)];
  const renderPanel = (services = SERVICES, chaosEnabled = true) => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><SystemScenarioPanel services={services} chaosEnabled={chaosEnabled} /></QueryClientProvider>);
  };
  const button = () => screen.getByRole('button', { name: '구매 경로 장애 주입' });

  it('대상은 내릴 수 있고 레플리카 2 이상인 서비스만(review · gateway 제외)', () => {
    renderPanel();
    expect(screen.getByText('order · user')).toBeTruthy();
    expect(button().disabled).toBe(false);
  });

  it('확인 창에서 내리면 시나리오 API 를 부르고 결과를 알려 준다', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { services: [{ service: 'order-service' }, { service: 'user-service' }] } } });
    renderPanel();
    fireEvent.click(button());
    expect(screen.getByText(/order · user 파드를 1개씩 지웁니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '장애 주입' }));
    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('2개 서비스에 장애를 주입했어요 — 파드 1개씩 제거'));
    expect(post).toHaveBeenCalledWith(`${BASE}/scenarios/kill-one-each`, {});
  });

  it('대상 중 하나라도 정상이 아니면 막고 이유를 보여 준다', () => {
    renderPanel([svc('order-service', 2, 'RECOVERING'), svc('user-service', 2)]);
    expect(button().disabled).toBe(true);
    expect(screen.getByText('모든 대상 서비스가 정상일 때만 실행할 수 있어요.')).toBeTruthy();
  });

  it('내리기 기능이 꺼져 있으면 막는다', () => {
    renderPanel(SERVICES, false);
    expect(button().disabled).toBe(true);
    expect(screen.getByText('내리기 기능이 꺼져 있어요.')).toBeTruthy();
  });

  it('서버가 준비 안 됨으로 거절하면 정해진 문구, 그 밖에는 서버 문구를 보여 준다', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockRejectedValueOnce({ response: { data: { code: 'SYSTEM_SCENARIO_NOT_READY', message: 'x' } } });
    renderPanel();
    fireEvent.click(button());
    fireEvent.click(screen.getByRole('button', { name: '장애 주입' }));
    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('모든 대상 서비스가 정상일 때만 실행할 수 있어요.'));
    post.mockRejectedValueOnce({ response: { data: { code: 'SYSTEM_KILL_COOLDOWN', message: '방금 내린 서비스가 있어요.' } } });
    fireEvent.click(button());
    fireEvent.click(screen.getByRole('button', { name: '장애 주입' }));
    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('방금 내린 서비스가 있어요.'));
  });

  it('타임라인에서 시나리오로 내린 기록을 구분한다', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [
      { eventId: '2', service: 'order-service', scope: 'ONE', reason: '시나리오 — 레플리카 2 서비스 1개씩 내리기', killedAt: '2026-11-10T05:00:00Z', recoveredAt: null, recoverySeconds: null },
      { eventId: '1', service: 'review-service', scope: 'ALL', reason: null, killedAt: '2026-11-10T04:00:00Z', recoveredAt: null, recoverySeconds: null },
    ] } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><SystemTimeline /></QueryClientProvider>);
    const rows = await screen.findAllByRole('listitem');
    expect(rows[0].textContent).toContain('이중화 검증');
    expect(rows[1].textContent).not.toContain('이중화 검증');
  });
});
