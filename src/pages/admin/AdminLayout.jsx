import { LayoutDashboard, FileCheck, Store, Wallet, Users, Flag, Tags, MessagesSquare } from 'lucide-react';
import ConsoleLayout from '@/shared/layouts/ConsoleLayout';
import NotificationBell from '@/features/notification/components/NotificationBell';
import { useApplicationsQuery } from '@/features/admin/hooks/useApplicationsQuery';
import { useAdminDashboardQuery } from '@/features/admin/hooks/useAdminDashboardQuery';
import { useAdminReportsQuery } from '@/features/admin/hooks/useAdminReportsQuery';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useChatUnreadCountQuery } from '@/features/chat/hooks/useChatQueries';

// 관리자 콘솔 레이아웃 — 메뉴 배지 숫자는 각 목록 훅에서 (목업은 모듈 변수에서 직접 계산)
export default function AdminLayout() {
  const logout = useLogout();
  const { data: apps = [] } = useApplicationsQuery();
  const { data: dash } = useAdminDashboardQuery(); // 정산 관리 배지 = 지급 보류 건수(settlement 플랫폼 통계)
  const { data: reports = [] } = useAdminReportsQuery();
  const { data: chatUnread = 0 } = useChatUnreadCountQuery();
  const groups = [
    { title: '홈', items: [{ to: '/admin', end: true, label: '대시보드', icon: LayoutDashboard }] },
    {
      title: '판매자',
      items: [
        { to: '/admin/applications', label: '입점 심사', icon: FileCheck, count: apps.filter((a) => a.status === '심사대기').length },
        { to: '/admin/stores', label: '스토어 관리', icon: Store },
        { to: '/admin/settlements', label: '정산 관리', icon: Wallet, count: dash?.settlement?.heldCount ?? 0 },
      ],
    },
    {
      title: '회원 · 콘텐츠',
      items: [
        { to: '/admin/users', label: '회원 관리', icon: Users },
        { to: '/admin/reports', label: '신고 관리', icon: Flag, count: reports.reduce((a, t) => a + t.openCount, 0) }, // 처리 대기 신고 수
        { to: '/admin/chats', label: '상담함', icon: MessagesSquare, count: chatUnread },
      ],
    },
    { title: '설정', items: [{ to: '/admin/categories', label: '카테고리 · 수수료', icon: Tags }] },
  ];
  return (
    <ConsoleLayout kind="admin" badge="운영관리" groups={groups} bell={<NotificationBell dark />} onLogout={logout}
      account={{ name: '곳간 운영팀', role: '파트너운영 · 최고관리자', avatar: '/images/avatar/u-2.jpg' }} />
  );
}
