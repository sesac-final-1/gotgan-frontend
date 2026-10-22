import ShopLayout from '@/shared/layouts/ShopLayout';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useCart } from '@/features/order/hooks/useCart';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useLogout } from '@/features/auth/hooks/useLogout';

// 쇼핑몰 레이아웃에 데이터 연결 — 카테고리(product) · 장바구니 수(order) · 로그인 상태(auth)
export default function ShopRoot() {
  const { data: categories = [] } = useCategoriesQuery();
  const { cartCount } = useCart();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  return <ShopLayout categories={categories} cartCount={cartCount} user={user} onLogout={logout} />;
}
