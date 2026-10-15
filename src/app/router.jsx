import { createBrowserRouter, Navigate } from 'react-router';
import RootLayout from '@/app/RootLayout';
import PendingPage from '@/shared/components/common/PendingPage';
import ShopRoot from '@/pages/shop/ShopRoot';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminApplicationsPage from '@/pages/admin/AdminApplicationsPage';
import AdminApplicationDetailPage from '@/pages/admin/AdminApplicationDetailPage';

// 전체 라우트 — 단일 파일 (컨벤션 4-3). 영역 · 도메인별 주석 구획 안에서만 추가, catch-all(*)은 항상 맨 마지막
// 경로는 목업과 같다. PendingPage = 아직 이식하지 않은 화면 (F4 에서 교체)
const pending = { element: <PendingPage /> };

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // ── shop (구매자 쇼핑몰)
      {
        element: <ShopRoot />,
        children: [
          { index: true, ...pending },
          { path: 'products', ...pending },
          { path: 'products/:id', ...pending },
          { path: 'stores', ...pending },
          { path: 'store/:id', ...pending },
          { path: 'cart', ...pending },
          { path: 'checkout', ...pending },
          { path: 'order/complete', ...pending },
          { path: 'login', ...pending },
          { path: 'signup', ...pending },
          { path: 'help', ...pending },
          { path: 'seller/apply', ...pending },

          // ── mypage
          {
            path: 'mypage',
            children: [
              { index: true, element: <Navigate to="orders" replace /> },
              { path: 'orders', ...pending },
              { path: 'orders/:id', ...pending },
              { path: 'claim/:lineId', ...pending },
              { path: 'claims', ...pending },
              { path: 'reviews', ...pending },
              { path: 'qna', ...pending },
              { path: 'points', ...pending },
              { path: 'profile', ...pending },
              { path: 'addresses', ...pending },
            ],
          },
        ],
      },

      // ── seller (판매자센터)
      {
        path: 'seller',
        children: [
          { index: true, ...pending },
          { path: 'products', ...pending },
          { path: 'products/new', ...pending },
          { path: 'products/:id/edit', ...pending },
          { path: 'orders', ...pending },
          { path: 'orders/:lineId', ...pending },
          { path: 'claims', ...pending },
          { path: 'reviews', ...pending },
          { path: 'qna', ...pending },
          { path: 'settlements', ...pending },
          { path: 'store', ...pending },
        ],
      },

      // ── admin (스토어 관리자)
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { index: true, ...pending },
          { path: 'applications', element: <AdminApplicationsPage /> },
          { path: 'applications/:id', element: <AdminApplicationDetailPage /> },
          { path: 'stores', ...pending },
          { path: 'stores/:id', ...pending },
          { path: 'settlements', ...pending },
          { path: 'users', ...pending },
          { path: 'users/:id', ...pending },
          { path: 'reviews', ...pending },
          { path: 'categories', ...pending },
        ],
      },

      // ── catch-all
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
