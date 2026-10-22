// 역할 가드 — 담당 이경석 (컨벤션 4-3). authStore.user.roles 로만 판단(토큰 디코딩 안 함), isAuthReady 전에는 판단하지 않는다
// 프론트 가드는 UX 장치 — 실제 접근 제어는 게이트웨이 · 서비스
import { Link, Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { homePathFor } from '@/features/auth/constants';

export default function RequireRole({ role, children }) {
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthReady) return <p className="pt-32 text-center text-sm text-mute">불러오는 중이에요…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!user.roles?.includes(role)) {
    return (
      <div className="pt-32 text-center">
        <p className="text-sm text-ink-2">이 화면을 볼 수 있는 권한이 없어요</p>
        <Link to={homePathFor(user.roles)} className="btn btn-line btn-sm mt-4">첫 화면으로</Link>
      </div>
    );
  }
  return children;
}
