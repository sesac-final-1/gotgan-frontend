import { useMemo } from 'react';
import MyPageLayout from '@/shared/layouts/MyPageLayout';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import { useMyPointsQuery } from '@/features/user/hooks/useMyPointsQuery';
import { useMyOrdersMockQuery, useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { openClaimCount } from '@/features/order/utils/orderView';
import { gradeById, nextGrade } from '@/features/user/constants';

// 마이페이지 레이아웃에 데이터 연결 — 회원 · 등급(user) · 포인트(user) · 리뷰/클레임 건수(order)
export default function MyPageRoot() {
  const { data: me } = useMeQuery();
  const { data: points } = useMyPointsQuery();
  const { data: myOrders } = useMyOrdersQuery();
  const { data: mockOrders = [] } = useMyOrdersMockQuery(); // TODO(이경석): 리뷰 API 가 나오면 작성 가능 리뷰 수를 그쪽에서
  const todoReviews = useMemo(() => mockOrders.flatMap((o) => o.items).filter((l) => l.status === '구매확정' && !l.reviewed).length, [mockOrders]);
  return (
    <MyPageLayout
      me={me}
      gradeLabel={me ? gradeById[me.grade]?.label : ''}
      next={me ? nextGrade(me.spent) : null}
      pointBalance={points?.balance ?? 0}
      todoReviews={todoReviews}
      openClaims={openClaimCount(myOrders?.statusCounts)}
    />
  );
}
