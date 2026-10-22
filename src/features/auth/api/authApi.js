// auth API — 담당 이경석
import { axiosInstance } from '@/shared/api/axiosInstance';

// 소셜 로그인 시작 주소 — XHR 이 아니라 브라우저 이동(302 → Keycloak → 제공자). 상대경로라야 콜백 쿠키가 같은 출처에 남는다
export const socialLoginUrl = (provider) => `/api/auth/social/${provider}`;

// POST /api/auth/login — { email, password } → { accessToken, expiresIn, user }. RT 는 Set-Cookie(HttpOnly)
export const login = (request) => axiosInstance.post('/api/auth/login', request).then((res) => res.data.data);

// GET /api/auth/email-availability?email= — { email, available } (탈퇴 회원 이메일도 available=false)
export const checkEmailAvailability = (email) =>
  axiosInstance.get('/api/auth/email-availability', { params: { email } }).then((res) => res.data.data);

// POST /api/auth/signup — { email, password, name, phone } → 201 { userId, login }. login 이 있으면 자동 로그인(RT 는 Set-Cookie), null 이면 로그인 화면으로
export const signup = (request) => axiosInstance.post('/api/auth/signup', request).then((res) => res.data.data);

// POST /api/auth/refresh — RT 쿠키로 AT 재발급 → { accessToken, expiresIn, user }
export const refreshToken = () => axiosInstance.post('/api/auth/refresh').then((res) => res.data.data);

// POST /api/auth/logout — Keycloak 세션 종료 · RT 쿠키 삭제
export const logout = () => axiosInstance.post('/api/auth/logout');
