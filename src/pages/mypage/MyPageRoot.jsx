import MyPageLayout from '@/shared/layouts/MyPageLayout';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import { useMyPointsQuery } from '@/features/user/hooks/useMyPointsQuery';
import { useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { useWritableReviewsQuery } from '@/features/review/hooks/useMyReviewsQuery';
import { openClaimCount } from '@/features/order/utils/orderView';
import { gradeById, nextGrade } from '@/features/user/constants';

// 마이페이지 레이아웃에 데이터 연결 — 회원 · 등급(user) · 포인트(user) · 작성 가능 리뷰 수(review) · 클레임 건수(order)
export default function MyPageRoot() {
  const { data: me } = useMeQuery();
  const { data: points } = useMyPointsQuery();
  const { data: myOrders } = useMyOrdersQuery();
  const { data: writable = [] } = useWritableReviewsQuery();
  return (
    <MyPageLayout
      me={me}
      gradeLabel={me ? gradeById[me.grade]?.label : ''}
      next={me ? nextGrade(me.spent) : null}
      pointBalance={points?.balance ?? 0}
      todoReviews={writable.length}
      openClaims={openClaimCount(myOrders?.statusCounts)}
    />
  );
}
