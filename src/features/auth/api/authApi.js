// auth API — 담당 이경석
import { axiosInstance } from '@/shared/api/axiosInstance';

// 소셜 로그인 시작 주소 — XHR 이 아니라 브라우저 이동(302 → Keycloak → 제공자). 상대경로라야 콜백 쿠키가 같은 출처에 남는다
export const socialLoginUrl = (provider) => `/api/auth/social/${provider}`;

// POST /api/auth/refresh — RT 쿠키로 AT 재발급 → { accessToken, expiresIn, user }
export const refreshToken = () => axiosInstance.post('/api/auth/refresh').then((res) => res.data.data);
