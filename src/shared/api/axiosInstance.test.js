import { AxiosError } from 'axios';
import { axiosInstance, setAuthHandlers } from '@/shared/api/axiosInstance';
import { refreshOnce } from '@/shared/api/refresh';

// 네트워크 대신 어댑터를 바꿔 끼워 요청 · 응답을 흉내 낸다
const ok = (config, data = {}) => Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });
const fail = (config, status) => Promise.reject(new AxiosError('fail', 'ERR', config, null, { data: {}, status, statusText: '', headers: {}, config }));

const originalAdapter = axiosInstance.defaults.adapter;
let token;

beforeEach(() => {
  token = 'old-at';
  setAuthHandlers({ getAccessToken: () => token, refresh: null, onAuthFailed: () => {} });
});

afterEach(() => {
  axiosInstance.defaults.adapter = originalAdapter;
  setAuthHandlers({ getAccessToken: () => null, refresh: null, onAuthFailed: () => {} });
});

describe('refreshOnce', () => {
  it('동시에 불러도 재발급 함수는 한 번 — 끝나면 다음 호출은 새로 실행', async () => {
    const doRefresh = vi.fn().mockResolvedValue('at');
    await Promise.all([refreshOnce(doRefresh), refreshOnce(doRefresh), refreshOnce(doRefresh)]);
    expect(doRefresh).toHaveBeenCalledTimes(1);
    await refreshOnce(doRefresh);
    expect(doRefresh).toHaveBeenCalledTimes(2);
  });

  it('실패해도 다음 호출은 다시 시도', async () => {
    const doRefresh = vi.fn().mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce('at');
    await expect(refreshOnce(doRefresh)).rejects.toThrow('401');
    await expect(refreshOnce(doRefresh)).resolves.toBe('at');
  });
});

describe('axiosInstance 인증 인터셉터', () => {
  it('Access Token 이 있으면 Authorization: Bearer 를 붙인다', async () => {
    const adapter = vi.fn((config) => ok(config));
    axiosInstance.defaults.adapter = adapter;
    await axiosInstance.get('/api/users/me');
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer old-at');
  });

  it('401 이 동시에 두 번 — 재발급은 한 번, 두 요청 모두 새 토큰으로 재시도', async () => {
    const refresh = vi.fn(async () => { token = 'new-at'; return { accessToken: 'new-at' }; });
    setAuthHandlers({ refresh });
    axiosInstance.defaults.adapter = vi.fn((config) => (
      config.headers.Authorization === 'Bearer new-at' ? ok(config, { url: config.url }) : fail(config, 401)));

    const [a, b] = await Promise.all([axiosInstance.get('/api/users/me'), axiosInstance.get('/api/users/me/points')]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect([a.data.url, b.data.url]).toEqual(['/api/users/me', '/api/users/me/points']);
  });

  it('재발급도 실패하면 비로그인 처리 후 원래 401 을 그대로 던진다', async () => {
    const onAuthFailed = vi.fn();
    setAuthHandlers({ refresh: vi.fn().mockRejectedValue(new Error('expired')), onAuthFailed });
    axiosInstance.defaults.adapter = vi.fn((config) => fail(config, 401));

    await expect(axiosInstance.get('/api/users/me')).rejects.toMatchObject({ response: { status: 401 } });
    expect(onAuthFailed).toHaveBeenCalledTimes(1);
  });

  it('로그인 · 재발급 자체의 401, 토큰 없이 받은 401, 403 은 재발급하지 않는다', async () => {
    const refresh = vi.fn();
    setAuthHandlers({ refresh });
    axiosInstance.defaults.adapter = vi.fn((config) => fail(config, config.url === '/api/forbidden' ? 403 : 401));

    await expect(axiosInstance.post('/api/auth/login', {})).rejects.toBeInstanceOf(AxiosError);
    await expect(axiosInstance.post('/api/auth/refresh')).rejects.toBeInstanceOf(AxiosError);
    await expect(axiosInstance.get('/api/forbidden')).rejects.toBeInstanceOf(AxiosError);
    token = null;
    await expect(axiosInstance.get('/api/users/me')).rejects.toBeInstanceOf(AxiosError);
    expect(refresh).not.toHaveBeenCalled();
  });
});
