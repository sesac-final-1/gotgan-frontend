import { MyPageHead } from '@/shared/layouts/MyPageLayout';
import ChatInbox from '@/features/chat/components/ChatInbox';

// /mypage/chats(/:roomId) — 스토어 톡 · 고객센터 1:1 상담 (chat.md)
export default function MyChatsPage() {
  return (
    <>
      <MyPageHead>1:1 채팅</MyPageHead>
      <ChatInbox kind="buyer" basePath="/mypage/chats" />
    </>
  );
}
