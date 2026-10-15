import { useMemo } from 'react';
import MyPageLayout from '@/shared/layouts/MyPageLayout';
import { useMeQuery } from '@/features/user/hooks/useMeQuery';
import { useMyPointsQuery } from '@/features/user/hooks/useMyPointsQuery';
import { useMyOrdersQuery } from '@/features/order/hooks/useMyOrdersQuery';
import { gradeById, nextGrade } from '@/features/user/constants';

const OPEN_CLAIMS = ['취소요청', '반품요청', '교환요청'];

// 마이페이지 레이아웃에 데이터 연결 — 회원 · 등급(user) · 포인트(user) · 리뷰/클레임 건수(order)
export default function MyPageRoot() {
  const { data: me } = useMeQuery();
  const { data: points } = useMyPointsQuery();
  const { data: orders = [] } = useMyOrdersQuery();
  const lines = useMemo(() => orders.flatMap((o) => o.items), [orders]);
  return (
    <MyPageLayout
      me={me}
      gradeLabel={me ? gradeById[me.grade]?.label : ''}
      next={me ? nextGrade(me.spent) : null}
      pointBalance={points?.balance ?? 0}
      todoReviews={lines.filter((l) => l.status === '구매확정' && !l.reviewed).length}
      openClaims={lines.filter((l) => OPEN_CLAIMS.includes(l.status)).length}
    />
  );
}
