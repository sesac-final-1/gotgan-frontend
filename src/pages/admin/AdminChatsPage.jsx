import { PageHead } from '@/shared/components/ui';
import ChatInbox from '@/features/chat/components/ChatInbox';

// /admin/chats(/:roomId) — 판매자 운영 상담 · 고객센터 1:1 상담 (관리자 전원 공용, 표시 이름 "곳간 운영팀")
export default function AdminChatsPage() {
  return (
    <>
      <PageHead title="상담함" desc="판매자 · 고객 상담을 관리자 전원이 함께 봅니다. 답변은 '곳간 운영팀' 이름으로 나갑니다." />
      <ChatInbox kind="admin" basePath="/admin/chats" />
    </>
  );
}
