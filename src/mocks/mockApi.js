// 목업 API 응답 — 실제 네트워크처럼 비동기로 돌려줘 화면의 로딩 상태가 동작하게 한다.
// 각 features/{도메인}/api/*Api.js 가 이 함수를 쓰고, API 가 준비되면 axiosInstance 호출로 교체 (docs/MOCK-TO-API.md)
export const mockResolve = (data, ms = 120) => new Promise((resolve) => setTimeout(() => resolve(data), ms));
