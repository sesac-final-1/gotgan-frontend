import axios from 'axios';

// 모든 API 호출은 이 인스턴스로 — 상대경로 /api/... (운영: Vercel rewrite → DuckDNS, 로컬: Vite 프록시) · 쿠키(refresh) 전송
export const axiosInstance = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 10_000,
});

// TODO(이경석): Authorization 헤더(accessToken) · 401 시 single-flight refresh 후 재시도 (컨벤션 4-4, shared/api/refresh.js)
