import { createBrowserRouter } from 'react-router';

// 전체 라우트 — 단일 파일 (컨벤션 4-3). 영역 · 도메인별 주석 구획 안에서만 추가, catch-all(*)은 항상 맨 마지막
export const router = createBrowserRouter([
  // ── shop (구매자)
  { path: '/', element: <div className="p-10">곳간 프론트 뼈대 — 화면 이식 중</div> },

  // ── mypage

  // ── seller (판매자센터)

  // ── admin (관리자)

  // ── catch-all
  { path: '*', element: <div className="p-10">페이지를 찾을 수 없어요</div> },
]);
