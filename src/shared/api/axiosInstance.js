import axios from 'axios';
import { refreshOnce } from '@/shared/api/refresh';

// 모든 API 호출은 이 인스턴스로 — 상대경로 /api/... (운영: Vercel rewrite → https://api.gotgan.click, 로컬: Vite 프록시) · 쿠키(refresh) 전송
export const axiosInstance = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 10_000,
});

// 인증 연결 — shared 는 features 를 모르므로 app/bootstrap.js 가 authStore 와 이어 준다 (컨벤션 4-2 규칙 4)
let authHandlers = {
  getAccessToken: () => null,
  refresh: null, // () => Promise<{ accessToken, ... }> — single-flight 로 감싸지 않은 원본 (여기서 refreshOnce 로 감싼다)
  onAuthFailed: () => {},
};

export function setAuthHandlers(handlers) {
  authHandlers = { ...authHandlers, ...handlers };
}

// 로그인 · 재발급 · 로그아웃 자체의 401 은 재발급 대상이 아니다 (로그인 실패 · 세션 만료를 그대로 화면에)
const isAuthEndpoint = (url = '') => /^\/api\/auth\/(login|refresh|logout|signup|social)/.test(url);

axiosInstance.interceptors.request.use((config) => {
  const accessToken = authHandlers.getAccessToken();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Access Token 만료(401) → single-flight 재발급 후 원 요청 한 번 재시도. 재발급도 실패하면 비로그인 상태로
axiosInstance.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  const canRetry = response?.status === 401 && config && !config._retried && !isAuthEndpoint(config.url)
    && authHandlers.refresh && authHandlers.getAccessToken(); // 토큰 없이 받은 401 = 원래 로그인이 필요한 요청
  if (!canRetry) return Promise.reject(error);
  config._retried = true;
  try {
    const { accessToken } = await refreshOnce(authHandlers.refresh);
    config.headers.Authorization = `Bearer ${accessToken}`;
    return axiosInstance(config);
  } catch {
    authHandlers.onAuthFailed();
    return Promise.reject(error);
  }
});
