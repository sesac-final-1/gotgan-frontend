import { createBrowserRouter, Navigate } from 'react-router';
import RootLayout from '@/app/RootLayout';
import RouteError from '@/app/RouteError';
import RequireRole from '@/features/auth/components/RequireRole';
import ShopRoot from '@/pages/shop/ShopRoot';

// 전체 라우트 — 단일 파일 (컨벤션 4-3). 영역 · 도메인별 주석 구획 안에서만 추가, catch-all(*)은 항상 맨 마지막
// 경로는 목업과 같다. 접근 권한은 컨벤션 4-3 표 그대로 RequireRole 로 (공개 화면은 감싸지 않음)
// 코드 분할: 화면은 그 경로에 처음 들어갈 때 받는다 (판매자 · 관리자 화면이 쇼핑몰 첫 로딩에 섞이지 않게).
//   새 경로도 import 대신 page(() => import('@/pages/…')) 로 추가 — 권한이 필요하면 두 번째 인자로 감싼다

/** 화면 지연 로딩 — 받는 동안은 이전 화면을 그대로 두고, 받기에 실패하면(배포 직후 옛 파일 등) RouteError 가 새로고침을 안내 */
const page = (importer, wrap = (el) => el) => ({
  lazy: async () => {
    const { default: Page } = await importer();
    return { element: wrap(<Page />) };
  },
});
const as = (role) => (el) => <RequireRole role={role}>{el}</RequireRole>;

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <p className="text-mute py-10 text-center">불러오는 중…</p>,
    children: [
      // ── shop (구매자 쇼핑몰)
      {
        element: <ShopRoot />,
        children: [
          { index: true, ...page(() => import('@/pages/shop/HomePage')) },
          { path: 'products', ...page(() => import('@/pages/shop/ProductListPage')) },
          { path: 'products/:id', ...page(() => import('@/pages/shop/ProductDetailPage')) },
          { path: 'stores', ...page(() => import('@/pages/shop/StoreListPage')) },
          { path: 'store/:id', ...page(() => import('@/pages/shop/StoreHomePage')) },
          { path: 'cart', ...page(() => import('@/pages/shop/CartPage'), as('BUYER')) },
          { path: 'checkout', ...page(() => import('@/pages/shop/CheckoutPage'), as('BUYER')) },
          { path: 'order/complete', ...page(() => import('@/pages/shop/OrderCompletePage'), as('BUYER')) },
          { path: 'login', ...page(() => import('@/pages/shop/LoginPage')) },
          { path: 'signup', ...page(() => import('@/pages/shop/SignupPage')) },
          { path: 'auth/callback', ...page(() => import('@/pages/shop/AuthCallbackPage')) },
          { path: 'help', ...page(() => import('@/pages/shop/HelpPage')) },
          { path: 'seller/apply', ...page(() => import('@/pages/shop/SellerApplyPage'), as('BUYER')) },

          // ── mypage
          {
            path: 'mypage',
            ...page(() => import('@/pages/mypage/MyPageRoot'), as('BUYER')),
            children: [
              { index: true, element: <Navigate to="orders" replace /> },
              { path: 'orders', ...page(() => import('@/pages/mypage/MyOrdersPage')) },
              { path: 'orders/:id', ...page(() => import('@/pages/mypage/MyOrderDetailPage')) },
              { path: 'claim/:lineId', ...page(() => import('@/pages/mypage/MyClaimRequestPage')) },
              { path: 'claims', ...page(() => import('@/pages/mypage/MyClaimsPage')) },
              { path: 'reviews', ...page(() => import('@/pages/mypage/MyReviewsPage')) },
              { path: 'qna', ...page(() => import('@/pages/mypage/MyQnaPage')) },
              { path: 'points', ...page(() => import('@/pages/mypage/MyPointsPage')) },
              { path: 'profile', ...page(() => import('@/pages/mypage/MyProfilePage')) },
              { path: 'addresses', ...page(() => import('@/pages/mypage/MyAddressesPage')) },
            ],
          },
        ],
      },

      // ── seller (판매자센터)
      {
        path: 'seller',
        ...page(() => import('@/pages/seller/SellerLayout'), as('SELLER')),
        children: [
          { index: true, ...page(() => import('@/pages/seller/SellerDashboardPage')) },
          { path: 'products', ...page(() => import('@/pages/seller/SellerProductListPage')) },
          { path: 'products/new', ...page(() => import('@/pages/seller/SellerProductFormPage')) },
          { path: 'products/:id/edit', ...page(() => import('@/pages/seller/SellerProductFormPage')) },
          { path: 'orders', ...page(() => import('@/pages/seller/SellerOrderListPage')) },
          { path: 'orders/:lineId', ...page(() => import('@/pages/seller/SellerOrderDetailPage')) },
          { path: 'claims', ...page(() => import('@/pages/seller/SellerClaimsPage')) },
          { path: 'reviews', ...page(() => import('@/pages/seller/SellerReviewsPage')) },
          { path: 'qna', ...page(() => import('@/pages/seller/SellerQnaPage')) },
          { path: 'settlements', ...page(() => import('@/pages/seller/SellerSettlementsPage')) },
          { path: 'store', ...page(() => import('@/pages/seller/SellerStorePage')) },
        ],
      },

      // ── admin (스토어 관리자)
      {
        path: 'admin',
        ...page(() => import('@/pages/admin/AdminLayout'), as('ADMIN')),
        children: [
          { index: true, ...page(() => import('@/pages/admin/AdminDashboardPage')) },
          { path: 'applications', ...page(() => import('@/pages/admin/AdminApplicationsPage')) },
          { path: 'applications/:id', ...page(() => import('@/pages/admin/AdminApplicationDetailPage')) },
          { path: 'stores', ...page(() => import('@/pages/admin/AdminStoresPage')) },
          { path: 'stores/:id', ...page(() => import('@/pages/admin/AdminStoreDetailPage')) },
          { path: 'settlements', ...page(() => import('@/pages/admin/AdminSettlementsPage')) },
          { path: 'users', ...page(() => import('@/pages/admin/AdminUsersPage')) },
          { path: 'users/:id', ...page(() => import('@/pages/admin/AdminUserDetailPage')) },
          { path: 'reports', ...page(() => import('@/pages/admin/AdminReportsPage')) },
          { path: 'categories', ...page(() => import('@/pages/admin/AdminCategoriesPage')) },
        ],
      },

      // ── catch-all
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
