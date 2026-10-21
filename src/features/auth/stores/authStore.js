import { create } from 'zustand';

// 로그인 상태 — 담당 이경석. AT 는 메모리에만 (컨벤션 4-4: localStorage · sessionStorage 금지, RT 는 HttpOnly 쿠키)
export const useAuthStore = create((set) => ({
  accessToken: null,
  user: null, // { userId, name, roles[], storeId }
  isAuthReady: false,
  setAuth: ({ accessToken, user }) => set({ accessToken, user, isAuthReady: true }),
  clearAuth: () => set({ accessToken: null, user: null, isAuthReady: true }),
}));
