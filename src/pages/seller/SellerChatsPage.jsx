import { PageHead } from '@/shared/components/ui';
import ChatInbox from '@/features/chat/components/ChatInbox';
import OpenChatButton from '@/features/chat/components/OpenChatButton';

// /seller/chats(/:roomId) — 스토어 톡(구매자 문의) · 판매자 운영 상담 (chat.md)
export default function SellerChatsPage() {
  return (
    <>
      <PageHead title="채팅" desc="구매자 스토어 톡과 운영팀 상담을 한곳에서 봅니다."
        right={<OpenChatButton request={{ type: 'SELLER_SUPPORT' }} basePath="/seller/chats">운영팀에 문의</OpenChatButton>} />
      <ChatInbox kind="seller" basePath="/seller/chats" />
    </>
  );
}
