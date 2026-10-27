import { useNavigate } from 'react-router';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useOpenChatMutation } from '@/features/chat/hooks/useChatQueries';

/**
 * 다른 화면에서 채팅 열기 — 같은 방이 있으면 그 방에 문맥 카드만 붙는다(chat.md 1절). 열리면 basePath/{roomId} 로 이동.
 * request = { type, storeId?, context?: { type, id } }. 로그인 전이면 로그인 화면으로
 */
export default function OpenChatButton({ request, basePath, className = 'btn btn-line btn-sm', children }) {
  const navigate = useNavigate();
  const loggedIn = useAuthStore((s) => !!s.user);
  const open = useOpenChatMutation();
  const onClick = () => {
    if (!loggedIn) return navigate('/login');
    return open.mutate(request, { onSuccess: (room) => navigate(`${basePath}/${room.roomId}`) });
  };
  return <button type="button" className={className} disabled={open.isPending} onClick={onClick}>{children}</button>;
}
