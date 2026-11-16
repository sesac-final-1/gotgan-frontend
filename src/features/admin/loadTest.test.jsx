import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchLoadTest, prepareLoadTestAccounts, scaleLoadTest, startLoadTest, stopLoadTest } from '@/features/admin/api/systemApi';
import LoadTestChart from '@/features/admin/components/LoadTestChart';
import SystemLoadTestPanel from '@/features/admin/components/SystemLoadTestPanel';
import { useToastStore } from '@/shared/stores/toastStore';

// 관리자 화면 부하테스트 — 계약 backend admin.md 8절. 서버를 흉내 내는 작은 상태 하나로 시작 · 조절 · 중지 · 계정 준비를 확인한다
const URL = '/api/admin/system/loadtest';

// 시나리오는 화면(SystemDashboard)이 들고 있다 — 테스트에서도 같은 방식으로
function ControlledPanel() {
  const [scenario, setScenario] = useState('BROWSE');
  return <SystemLoadTestPanel scenario={scenario} onScenarioChange={setScenario} />;
}
let server;

function resetServer({ enabled = true, load = null, accounts = null } = {}) {
  server = { enabled, load, accounts, scaled: [] };
}

const series = () => ({
  vus: [{ t: 1000, v: 40 }, { t: 6000, v: 120 }],
  rps: [{ t: 1000, v: 50 }, { t: 6000, v: 150.4 }],
  p95Ms: [{ t: 6000, v: 87.2 }],
  errorRate: [{ t: 6000, v: 0 }],
});

function stubServer() {
  vi.spyOn(axiosInstance, 'get').mockImplementation(async () => ({
    data: { data: { enabled: server.enabled, maxVus: 300, load: server.load, accounts: server.accounts, series: server.load ? series() : {} } },
  }));
  vi.spyOn(axiosInstance, 'post').mockImplementation(async (url, body) => {
    if (url === `${URL}/accounts`) server.accounts = { id: 'lt-2', state: 'RUNNING' };
    else server.load = { id: 'lt-1', scenario: body.scenario, state: 'RUNNING', vus: body.vus, durationSec: body.durationSec, startedAt: new Date().toISOString() };
    return { data: { data: { id: 'lt-1' } } };
  });
  vi.spyOn(axiosInstance, 'patch').mockImplementation(async (url, body) => { server.scaled.push(body.vus); return { data: { data: null } }; });
  vi.spyOn(axiosInstance, 'delete').mockImplementation(async () => { server.load = { ...server.load, state: 'DONE' }; return { data: { data: null } }; });
}

describe('부하테스트 API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('조회 · 시작 · 변경 · 중지 · 계정 준비 경로와 본문', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { enabled: true } } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { id: 'lt-1' } } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: null } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: { data: null } });

    await expect(fetchLoadTest()).resolves.toEqual({ enabled: true });
    await expect(startLoadTest({ scenario: 'CART', vus: 20, durationSec: 60 })).resolves.toEqual({ id: 'lt-1' });
    await scaleLoadTest({ vus: 0 });
    await stopLoadTest();
    await prepareLoadTestAccounts();

    expect(get).toHaveBeenCalledWith(URL);
    expect(post).toHaveBeenCalledWith(URL, { scenario: 'CART', vus: 20, durationSec: 60 });
    expect(patch).toHaveBeenCalledWith(URL, { vus: 0 });
    expect(del).toHaveBeenCalledWith(URL);
    expect(post).toHaveBeenLastCalledWith(`${URL}/accounts`);
  });
});

describe('부하테스트 패널', () => {
  let queryClient;
  beforeEach(() => { resetServer(); stubServer(); useToastStore.setState({ current: null }); });
  afterEach(() => {
    cleanup();
    queryClient?.clear();
    vi.restoreAllMocks();
  });
  const renderPanel = () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><ControlledPanel /></QueryClientProvider>);
  };
  const lastToast = () => useToastStore.getState().current?.msg;

  it('시작하면 고른 시나리오 · 사용자 수 · 시간으로 보내고 실행 중 그래프를 보여 준다', async () => {
    renderPanel();
    fireEvent.change(await screen.findByRole('combobox', { name: '시나리오' }), { target: { value: 'REVIEWS' } });
    fireEvent.change(screen.getByRole('combobox', { name: '최대 시간' }), { target: { value: '180' } });
    fireEvent.change(screen.getByRole('slider', { name: '동시 사용자 수' }), { target: { value: '80' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '부하 시작' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '부하 시작' }));

    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledWith(URL, { scenario: 'REVIEWS', vus: 80, durationSec: 180 }));
    expect(await screen.findByText(/실행 중 \d\d:\d\d/)).toBeTruthy();
    expect(screen.getByText('120명')).toBeTruthy();
    expect(screen.getByText('150건')).toBeTruthy();
    expect(screen.getByLabelText('시나리오가 쓰는 서비스').textContent).toContain('review');
    expect(lastToast()).toContain('80명');
  });

  it('실행 중에는 슬라이더를 놓을 때 사용자 수를 바꾸고, 중지할 수 있다', async () => {
    resetServer({ load: { id: 'lt-1', scenario: 'BROWSE', state: 'RUNNING', vus: 50, durationSec: 300, startedAt: new Date().toISOString() } });
    renderPanel();
    const slider = await screen.findByRole('slider', { name: '동시 사용자 수' });
    await screen.findByRole('button', { name: '중지' });
    fireEvent.change(slider, { target: { value: '200' } });
    fireEvent.pointerUp(slider);
    await waitFor(() => expect(server.scaled).toEqual([200]));

    fireEvent.click(screen.getByRole('button', { name: '중지' }));
    await waitFor(() => expect(axiosInstance.delete).toHaveBeenCalledWith(URL));
    expect(await screen.findByRole('button', { name: '부하 시작' })).toBeTruthy();
    expect(lastToast()).toBe('부하테스트를 중지했어요.');
  });

  it('실행 중이 아니면 슬라이더를 놓아도 요청하지 않는다', async () => {
    renderPanel();
    const slider = await screen.findByRole('slider', { name: '동시 사용자 수' });
    fireEvent.change(slider, { target: { value: '100' } });
    fireEvent.keyUp(slider);
    expect(axiosInstance.patch).not.toHaveBeenCalled();
  });

  it('계정 준비를 누르면 실행 중으로 바뀌고 시작 버튼이 잠긴다', async () => {
    renderPanel();
    const button = await screen.findByRole('button', { name: '계정 준비' });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    expect(await screen.findByText('계정 준비 실행 중')).toBeTruthy();
    expect(screen.getByRole('button', { name: '부하 시작' }).disabled).toBe(true);
  });

  it('기능이 꺼져 있으면 안내하고 버튼을 잠근다', async () => {
    resetServer({ enabled: false });
    renderPanel();
    expect(await screen.findByText(/부하테스트 기능이 꺼져 있어요/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '부하 시작' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '계정 준비' }).disabled).toBe(true);
  });

  it('시작이 거절되면 서버 메시지를 알려 준다', async () => {
    axiosInstance.post.mockRejectedValue({ response: { data: { message: '이미 실행 중인 부하테스트가 있습니다.' } } });
    renderPanel();
    const button = await screen.findByRole('button', { name: '부하 시작' });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(lastToast()).toBe('이미 실행 중인 부하테스트가 있습니다.'));
  });
});

describe('부하테스트 그래프', () => {
  afterEach(cleanup);

  it('점이 없으면 - , 있으면 마지막 값을 형식대로 보여 준다', () => {
    const { rerender } = render(<LoadTestChart label="초당 요청" format={(v) => `${v}건`} />);
    expect(screen.getByText('-')).toBeTruthy();
    rerender(<LoadTestChart label="초당 요청" points={[{ t: 0, v: 3 }, { t: 5000, v: 7 }]} format={(v) => `${v}건`} />);
    expect(screen.getByText('7건')).toBeTruthy();
    expect(screen.getByRole('figure', { name: '초당 요청' }).querySelector('polyline')).toBeTruthy();
  });

  it('시작 직후에는 첫 점부터 30초 창, 3분이 넘으면 최근 3분만 그린다', () => {
    const { rerender } = render(<LoadTestChart label="p95" points={[{ t: 0, v: 1 }, { t: 30_000, v: 1 }]} format={String} />);
    const xs = () => screen.getByRole('figure', { name: 'p95' }).querySelector('polyline').getAttribute('points').split(' ').map((p) => Number(p.split(',')[0]));
    expect(xs()).toEqual([0, 300]);   // 30초 = 최소 창 전부
    rerender(<LoadTestChart label="p95" points={[{ t: 0, v: 1 }, { t: 300_000, v: 1 }, { t: 600_000, v: 1 }]} format={String} />);
    expect(xs()).toEqual([-700, -200, 300]);   // 최근 3분만 화면 안
  });
});
