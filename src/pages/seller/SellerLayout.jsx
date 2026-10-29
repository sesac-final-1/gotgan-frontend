import { LayoutDashboard, Package, PlusSquare, ShoppingCart, RotateCcw, Star, MessageCircle, MessagesSquare, Wallet, Store } from 'lucide-react';
import ConsoleLayout from '@/shared/layouts/ConsoleLayout';
import NotificationBell from '@/features/notification/components/NotificationBell';
import { useSellerOrderItemsQuery } from '@/features/order/hooks/useSellerOrderItemsQuery';
import { openClaimCount } from '@/features/order/utils/orderView';
import { useSellerInquirySummaryQuery } from '@/features/review/hooks/useInquiries';
import { useMyStoreQuery } from '@/features/store/hooks/useMyStoreQuery';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useChatUnreadCountQuery } from '@/features/chat/hooks/useChatQueries';

// 판매자센터 레이아웃 — 메뉴 배지 · 알림 숫자 · 계정은 각 훅에서 (목업은 모듈 변수에서 직접 계산)
export default function SellerLayout() {
  const logout = useLogout();
  const { data: sellerOrders } = useSellerOrderItemsQuery({ page: 0, size: 1 }); // 탭 숫자(statusCounts)만 쓴다
  const { data: inquiryCounts } = useSellerInquirySummaryQuery(); // 미답변 문의 배지
  const { data: store } = useMyStoreQuery();
  const { data: chatUnread = 0 } = useChatUnreadCountQuery();
  const unanswered = inquiryCounts?.unanswered ?? 0;
  const cnt = (s) => sellerOrders?.statusCounts?.[s] ?? 0;
  const claims = openClaimCount(sellerOrders?.statusCounts);
  const groups = [
    { title: '홈', items: [{ to: '/seller', end: true, label: '대시보드', icon: LayoutDashboard }] },
    { title: '상품', items: [
      { to: '/seller/products', end: true, label: '상품 조회/수정', icon: Package },
      { to: '/seller/products/new', label: '상품 등록', icon: PlusSquare },
    ] },
    { title: '주문 · 배송', items: [
      { to: '/seller/orders', label: '주문 관리', icon: ShoppingCart, count: cnt('PAYMENT_DONE') },
      { to: '/seller/claims', label: '취소/반품/교환', icon: RotateCcw, count: claims },
    ] },
    { title: '고객', items: [
      { to: '/seller/reviews', label: '리뷰 관리', icon: Star },
      { to: '/seller/qna', label: '상품 문의', icon: MessageCircle, count: unanswered },
      { to: '/seller/chats', label: '채팅', icon: MessagesSquare, count: chatUnread },
    ] },
    { title: '정산 · 스토어', items: [
      { to: '/seller/settlements', label: '정산 내역', icon: Wallet },
      { to: '/seller/store', label: '스토어 설정', icon: Store },
    ] },
  ];
  return <ConsoleLayout kind="seller" badge="판매자센터" groups={groups} bell={<NotificationBell dark />} onLogout={logout}
    account={{ name: store?.name ?? '', role: store ? `${store.owner} 대표 · ${store.grade}` : '', avatar: '/images/avatar/u-6.jpg' }} />;
}
