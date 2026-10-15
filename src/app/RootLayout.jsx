import { Outlet } from 'react-router';
import { ToastHost } from '@/shared/components/ui';
import MockNav from '@/shared/components/common/MockNav';

// 모든 화면 공통 — 토스트 · (개발 중) 목업 화면 이동 패널
export default function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastHost />
      {import.meta.env.DEV && <MockNav />}
    </>
  );
}
