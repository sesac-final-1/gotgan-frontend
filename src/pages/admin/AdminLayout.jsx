import { LayoutDashboard, FileCheck, Store, Wallet, Users, Star, Tags } from 'lucide-react';
import ConsoleLayout from '@/shared/layouts/ConsoleLayout';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useAdminSettlementsQuery } from '@/features/admin/hooks/useAdminSettlementsQuery';
import { useAdminReviewsQuery } from '@/features/admin/hooks/useAdminReviewsQuery';

// 관리자 콘솔 레이아웃 — 메뉴 배지 숫자는 각 목록 훅에서 (목업은 모듈 변수에서 직접 계산)
export default function AdminLayout() {
  const { data: apps = [] } = useApplicationsQuery();
  const { data: settlements = [] } = useAdminSettlementsQuery();
  const { data: reviews = [] } = useAdminReviewsQuery();
  const groups = [
    { title: '홈', items: [{ to: '/admin', end: true, label: '대시보드', icon: LayoutDashboard }] },
    {
      title: '판매자',
      items: [
        { to: '/admin/applications', label: '입점 심사', icon: FileCheck, count: apps.filter((a) => a.status === '심사대기').length },
        { to: '/admin/stores', label: '스토어 관리', icon: Store },
        { to: '/admin/settlements', label: '정산 관리', icon: Wallet, count: settlements.filter((s) => s.status === '지급보류').length },
      ],
    },
    {
      title: '회원 · 콘텐츠',
      items: [
        { to: '/admin/users', label: '회원 관리', icon: Users },
        { to: '/admin/reviews', label: '리뷰 관리', icon: Star, count: reviews.filter((r) => r.flag && !r.blinded).length },
      ],
    },
    { title: '설정', items: [{ to: '/admin/categories', label: '카테고리 · 수수료', icon: Tags }] },
  ];
  const notices = [
    { text: '신규 입점 신청 2건 (숲속제과, 실과바늘)', time: '3시간 전', to: '/admin/applications' },
    { text: '9/21~9/27 주차 정산 지급 승인 대기 (9개 스토어)', time: '오늘 09:00', to: '/admin/settlements' },
    { text: '운영 정책 검토 대상 리뷰 1건', time: '어제', to: '/admin/reviews' },
  ];
  return (
    <ConsoleLayout kind="admin" badge="운영관리" groups={groups} notices={notices}
      account={{ name: '곳간 운영팀', role: '파트너운영 · 최고관리자', avatar: '/images/avatar/u-2.jpg' }} />
  );
}
