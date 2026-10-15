// 목업 API 응답 — 실제 네트워크처럼 비동기로 돌려줘 화면의 로딩 상태가 동작하게 한다.
// 각 features/{도메인}/api/*Api.js 가 이 함수를 쓰고, API 가 준비되면 axiosInstance 호출로 교체 (docs/MOCK-TO-API.md)
// structuredClone: 실제 API 처럼 매번 새 객체를 돌려준다 — 같은 참조를 돌려주면 목업 변경(mutation) 후에도
// TanStack Query 가 "안 바뀜"으로 보고 다른 화면(메뉴 배지 등)을 다시 그리지 않는다 (Date 도 그대로 복사됨)
export const mockResolve = (data, ms = 120) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms));
