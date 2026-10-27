import { createBrowserRouter, Navigate } from 'react-router';
import RootLayout from '@/app/RootLayout';
import RouteError from '@/app/RouteError';
import RequireRole from '@/features/auth/components/RequireRole';
import ShopRoot from '@/pages/shop/ShopRoot';

// 전체 라우트 — 단일 파일 (컨벤션 4-3). 영역 · 도메인별 표 안에서만 추가, catch-all(*)은 항상 맨 마지막
// 경로는 목업과 같다. 접근 권한은 컨벤션 4-3 표 그대로 RequireRole 로 (공개 화면은 감싸지 않음)
// 코드 분할: 화면은 그 경로에 처음 들어갈 때 받는다 (판매자 · 관리자 화면이 쇼핑몰 첫 로딩에 섞이지 않게).
//   새 화면은 아래 표에 '경로': '폴더/파일명' 한 줄로 추가 — 파일은 src/pages 아래에서 찾는다 ('' = 영역의 첫 화면)

// src/pages 의 화면 파일 (지연 로딩 — 파일마다 따로 받음). ShopRoot 는 쇼핑몰 틀이라 바로 넣는다
const PAGE_FILES = import.meta.glob(['/src/pages/**/*.jsx', '!/src/pages/shop/ShopRoot.jsx']);

/** 화면 지연 로딩 — 받는 동안은 이전 화면을 그대로 두고, 받기에 실패하면(배포 직후 옛 파일 등) RouteError 가 새로고침을 안내 */
const page = (name, role) => ({
  lazy: async () => {
    const { default: Page } = await PAGE_FILES[`/src/pages/${name}.jsx`]();
    return { element: role ? <RequireRole role={role}><Page /></RequireRole> : <Page /> };
  },
});
/** { '경로': '폴더/파일명' } 표 → 라우트 목록 */
const routes = (table, role) =>
  Object.entries(table).map(([path, name]) => ({ ...(path ? { path } : { index: true }), ...page(name, role) }));

// ── shop (구매자 쇼핑몰)
const SHOP = {
  '': 'shop/HomePage', products: 'shop/ProductListPage', 'products/:id': 'shop/ProductDetailPage', stores: 'shop/StoreListPage',
  'store/:id': 'shop/StoreHomePage', login: 'shop/LoginPage', signup: 'shop/SignupPage', 'auth/callback': 'shop/AuthCallbackPage',
  help: 'shop/HelpPage',
};
const SHOP_BUYER = {
  cart: 'shop/CartPage', checkout: 'shop/CheckoutPage', 'order/complete': 'shop/OrderCompletePage', 'seller/apply': 'shop/SellerApplyPage',
};
// ── mypage (BUYER — 틀에서 권한 확인)
const MYPAGE = {
  orders: 'mypage/MyOrdersPage', 'orders/:id': 'mypage/MyOrderDetailPage', 'claim/:lineId': 'mypage/MyClaimRequestPage',
  claims: 'mypage/MyClaimsPage', reviews: 'mypage/MyReviewsPage', qna: 'mypage/MyQnaPage', points: 'mypage/MyPointsPage',
  profile: 'mypage/MyProfilePage', addresses: 'mypage/MyAddressesPage',
};
// ── seller (판매자센터 — SELLER)
const SELLER = {
  '': 'seller/SellerDashboardPage', products: 'seller/SellerProductListPage', 'products/new': 'seller/SellerProductFormPage',
  'products/:id/edit': 'seller/SellerProductFormPage', orders: 'seller/SellerOrderListPage', 'orders/:lineId': 'seller/SellerOrderDetailPage',
  claims: 'seller/SellerClaimsPage', reviews: 'seller/SellerReviewsPage', qna: 'seller/SellerQnaPage',
  settlements: 'seller/SellerSettlementsPage', store: 'seller/SellerStorePage',
};
// ── admin (스토어 관리자 — ADMIN)
const ADMIN = {
  '': 'admin/AdminDashboardPage', applications: 'admin/AdminApplicationsPage', 'applications/:id': 'admin/AdminApplicationDetailPage',
  stores: 'admin/AdminStoresPage', 'stores/:id': 'admin/AdminStoreDetailPage', settlements: 'admin/AdminSettlementsPage',
  users: 'admin/AdminUsersPage', 'users/:id': 'admin/AdminUserDetailPage', reports: 'admin/AdminReportsPage',
  categories: 'admin/AdminCategoriesPage',
};

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <p className="text-mute py-10 text-center">불러오는 중…</p>,
    children: [
      {
        element: <ShopRoot />,
        children: [
          ...routes(SHOP),
          ...routes(SHOP_BUYER, 'BUYER'),
          {
            path: 'mypage',
            ...page('mypage/MyPageRoot', 'BUYER'),
            children: [{ index: true, element: <Navigate to="orders" replace /> }, ...routes(MYPAGE)],
          },
        ],
      },
      { path: 'seller', ...page('seller/SellerLayout', 'SELLER'), children: routes(SELLER) },
      { path: 'admin', ...page('admin/AdminLayout', 'ADMIN'), children: routes(ADMIN) },

      // ── catch-all
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
