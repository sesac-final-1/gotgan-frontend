import { renderHook } from '@testing-library/react';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { PRESENCE_PING_MS, usePresence } from '@/app/usePresence';
import { visitorId } from '@/shared/utils/visitorId';

// 접속 신호 — 보이는 동안 20초마다 ping, 숨기거나 닫으면 keepalive leave(토큰이 있으면 회원으로)
describe('usePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({});
    globalThis.fetch = vi.fn(() => Promise.resolve({}));
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('처음 한 번, 그 뒤 20초마다 ping, 숨기면 leave, 언마운트하면 멈춤', () => {
    useAuthStore.setState({ accessToken: 'tkn' });
    const { unmount } = renderHook(() => usePresence());
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PRESENCE_PING_MS * 2);
    expect(axiosInstance.post).toHaveBeenCalledTimes(3);
    expect(axiosInstance.post).toHaveBeenLastCalledWith('/api/presence/ping');

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/presence/leave', { method: 'POST', keepalive: true, headers: { 'X-Gotgan-Visitor': visitorId(), Authorization: 'Bearer tkn' } });
    vi.advanceTimersByTime(PRESENCE_PING_MS);
    expect(axiosInstance.post).toHaveBeenCalledTimes(3);   // 숨긴 동안은 ping 안 함

    unmount();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    vi.advanceTimersByTime(PRESENCE_PING_MS * 3);
    expect(axiosInstance.post).toHaveBeenCalledTimes(3);
  });
});

describe('visitorId', () => {
  it('브라우저마다 한 번 만들어 같은 값을 계속 쓴다', () => {
    const a = visitorId();
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(visitorId()).toBe(a);
    expect(localStorage.getItem('gotgan-visitor')).toBe(a);
  });
});
