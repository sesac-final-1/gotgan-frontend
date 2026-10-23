import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import MyProfile from '@/features/user/components/MyProfile';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { toast } from '@/shared/stores/toastStore';

// /mypage/profile — 회원정보 수정. 탈퇴 후 로그인 상태 정리는 여기서 (user · auth 를 잇는 곳은 페이지)
// 서버가 Keycloak 계정을 지웠으므로 로그아웃 호출 없이 메모리 AT · 캐시만 비운다 (남은 RT 쿠키는 재발급이 거절됨)
export default function MyProfilePage() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const handleWithdrawn = () => {
    useAuthStore.getState().clearAuth();
    queryClient.clear();
    toast('탈퇴가 완료되었어요. 그동안 이용해 주셔서 감사해요');
    void nav('/', { replace: true });
  };
  return <MyProfile onWithdrawn={handleWithdrawn} />;
}
