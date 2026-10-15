import ShopLayout from '@/shared/layouts/ShopLayout';
import { useCategoriesQuery } from '@/features/product/hooks/useCategoriesQuery';
import { useCart } from '@/features/order/hooks/useCart';

// 쇼핑몰 레이아웃에 데이터 연결 — 카테고리(product) · 장바구니 수(order)
export default function ShopRoot() {
  const { data: categories = [] } = useCategoriesQuery();
  const { cartCount } = useCart();
  return <ShopLayout categories={categories} cartCount={cartCount} />;
}
