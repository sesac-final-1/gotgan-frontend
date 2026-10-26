import { createBrowserRouter, Navigate } from 'react-router';
import RootLayout from '@/app/RootLayout';
import RequireRole from '@/features/auth/components/RequireRole';
import ShopRoot from '@/pages/shop/ShopRoot';
import HomePage from '@/pages/shop/HomePage';
import ProductListPage from '@/pages/shop/ProductListPage';
import ProductDetailPage from '@/pages/shop/ProductDetailPage';
import StoreListPage from '@/pages/shop/StoreListPage';
import StoreHomePage from '@/pages/shop/StoreHomePage';
import CartPage from '@/pages/shop/CartPage';
import CheckoutPage from '@/pages/shop/CheckoutPage';
import OrderCompletePage from '@/pages/shop/OrderCompletePage';
import LoginPage from '@/pages/shop/LoginPage';
import SignupPage from '@/pages/shop/SignupPage';
import AuthCallbackPage from '@/pages/shop/AuthCallbackPage';
import HelpPage from '@/pages/shop/HelpPage';
import SellerApplyPage from '@/pages/shop/SellerApplyPage';
import MyPageRoot from '@/pages/mypage/MyPageRoot';
import MyOrdersPage from '@/pages/mypage/MyOrdersPage';
import MyOrderDetailPage from '@/pages/mypage/MyOrderDetailPage';
import MyClaimRequestPage from '@/pages/mypage/MyClaimRequestPage';
import MyClaimsPage from '@/pages/mypage/MyClaimsPage';
import MyReviewsPage from '@/pages/mypage/MyReviewsPage';
import MyQnaPage from '@/pages/mypage/MyQnaPage';
import MyPointsPage from '@/pages/mypage/MyPointsPage';
import MyProfilePage from '@/pages/mypage/MyProfilePage';
import MyAddressesPage from '@/pages/mypage/MyAddressesPage';
import SellerLayout from '@/pages/seller/SellerLayout';
import SellerDashboardPage from '@/pages/seller/SellerDashboardPage';
import SellerProductListPage from '@/pages/seller/SellerProductListPage';
import SellerProductFormPage from '@/pages/seller/SellerProductFormPage';
import SellerOrderListPage from '@/pages/seller/SellerOrderListPage';
import SellerOrderDetailPage from '@/pages/seller/SellerOrderDetailPage';
import SellerClaimsPage from '@/pages/seller/SellerClaimsPage';
import SellerReviewsPage from '@/pages/seller/SellerReviewsPage';
import SellerQnaPage from '@/pages/seller/SellerQnaPage';
import SellerSettlementsPage from '@/pages/seller/SellerSettlementsPage';
import SellerStorePage from '@/pages/seller/SellerStorePage';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminApplicationsPage from '@/pages/admin/AdminApplicationsPage';
import AdminApplicationDetailPage from '@/pages/admin/AdminApplicationDetailPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminStoresPage from '@/pages/admin/AdminStoresPage';
import AdminStoreDetailPage from '@/pages/admin/AdminStoreDetailPage';
import AdminSettlementsPage from '@/pages/admin/AdminSettlementsPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminUserDetailPage from '@/pages/admin/AdminUserDetailPage';
import AdminReportsPage from '@/pages/admin/AdminReportsPage';
import AdminCategoriesPage from '@/pages/admin/AdminCategoriesPage';

// 전체 라우트 — 단일 파일 (컨벤션 4-3). 영역 · 도메인별 주석 구획 안에서만 추가, catch-all(*)은 항상 맨 마지막
// 경로는 목업과 같다. 접근 권한은 컨벤션 4-3 표 그대로 RequireRole 로 (공개 화면은 감싸지 않음)

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // ── shop (구매자 쇼핑몰)
      {
        element: <ShopRoot />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'products', element: <ProductListPage /> },
          { path: 'products/:id', element: <ProductDetailPage /> },
          { path: 'stores', element: <StoreListPage /> },
          { path: 'store/:id', element: <StoreHomePage /> },
          { path: 'cart', element: <RequireRole role="BUYER"><CartPage /></RequireRole> },
          { path: 'checkout', element: <RequireRole role="BUYER"><CheckoutPage /></RequireRole> },
          { path: 'order/complete', element: <RequireRole role="BUYER"><OrderCompletePage /></RequireRole> },
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
          { path: 'auth/callback', element: <AuthCallbackPage /> },
          { path: 'help', element: <HelpPage /> },
          { path: 'seller/apply', element: <RequireRole role="BUYER"><SellerApplyPage /></RequireRole> },

          // ── mypage
          {
            path: 'mypage',
            element: <RequireRole role="BUYER"><MyPageRoot /></RequireRole>,
            children: [
              { index: true, element: <Navigate to="orders" replace /> },
              { path: 'orders', element: <MyOrdersPage /> },
              { path: 'orders/:id', element: <MyOrderDetailPage /> },
              { path: 'claim/:lineId', element: <MyClaimRequestPage /> },
              { path: 'claims', element: <MyClaimsPage /> },
              { path: 'reviews', element: <MyReviewsPage /> },
              { path: 'qna', element: <MyQnaPage /> },
              { path: 'points', element: <MyPointsPage /> },
              { path: 'profile', element: <MyProfilePage /> },
              { path: 'addresses', element: <MyAddressesPage /> },
            ],
          },
        ],
      },

      // ── seller (판매자센터)
      {
        path: 'seller',
        element: <RequireRole role="SELLER"><SellerLayout /></RequireRole>,
        children: [
          { index: true, element: <SellerDashboardPage /> },
          { path: 'products', element: <SellerProductListPage /> },
          { path: 'products/new', element: <SellerProductFormPage /> },
          { path: 'products/:id/edit', element: <SellerProductFormPage /> },
          { path: 'orders', element: <SellerOrderListPage /> },
          { path: 'orders/:lineId', element: <SellerOrderDetailPage /> },
          { path: 'claims', element: <SellerClaimsPage /> },
          { path: 'reviews', element: <SellerReviewsPage /> },
          { path: 'qna', element: <SellerQnaPage /> },
          { path: 'settlements', element: <SellerSettlementsPage /> },
          { path: 'store', element: <SellerStorePage /> },
        ],
      },

      // ── admin (스토어 관리자)
      {
        path: 'admin',
        element: <RequireRole role="ADMIN"><AdminLayout /></RequireRole>,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'applications', element: <AdminApplicationsPage /> },
          { path: 'applications/:id', element: <AdminApplicationDetailPage /> },
          { path: 'stores', element: <AdminStoresPage /> },
          { path: 'stores/:id', element: <AdminStoreDetailPage /> },
          { path: 'settlements', element: <AdminSettlementsPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'users/:id', element: <AdminUserDetailPage /> },
          { path: 'reports', element: <AdminReportsPage /> },
          { path: 'categories', element: <AdminCategoriesPage /> },
        ],
      },

      // ── catch-all
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
