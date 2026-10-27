import { axiosInstance } from '@/shared/api/axiosInstance';
import {
  changeChatStatus, chatSocketUrl, fetchChatMessages, fetchChatRooms, fetchChatUnreadCount, openChatRoom, readChatRoom,
} from '@/features/chat/api/chatApi';
import { flattenMessages, frameToMessage, mySide, prependMessage, roomNotice, validateContent } from '@/features/chat/utils/chatView';

// chat-service 응답 흉내 (chat.md 1 · 3절)
const ROOM = {
  roomId: 7, type: 'STORE_INQUIRY', status: null, counterpart: { name: '스토어 #5', role: 'SELLER' }, storeId: 5, buyerId: 10,
  lastMessage: { preview: '안녕하세요', at: '2026-10-27T10:00:00+09:00' }, unreadCount: 1, createdAt: '2026-10-27T09:00:00+09:00',
};
const MESSAGE = { messageId: 3, roomId: 7, senderRole: 'BUYER', mine: true, kind: 'TEXT', content: '안녕하세요', context: null, createdAt: '2026-10-27T10:00:00+09:00' };

describe('chatApi', () => {
  it('요청 주소 · 본문 · 응답 변환', async () => {
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: ROOM } });
    vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({
      data: { data: url.endsWith('/messages') ? [MESSAGE] : url.endsWith('/unread-count') ? { count: 4 } : [ROOM, { ...ROOM, roomId: 8, lastMessage: null }] },
    }));
    vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { ...ROOM, status: 'RESOLVED' } } });

    const opened = await openChatRoom({ type: 'STORE_INQUIRY', storeId: 5 });
    expect(axiosInstance.post).toHaveBeenCalledWith('/api/chats/rooms', { type: 'STORE_INQUIRY', storeId: 5 });
    expect(opened.lastMessage.at).toBeInstanceOf(Date);

    const rooms = await fetchChatRooms({ type: 'STORE_INQUIRY' });
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/chats/rooms', { params: { type: 'STORE_INQUIRY', status: undefined } });
    expect(rooms[1].lastMessage).toBeNull();
    await fetchChatRooms();

    const messages = await fetchChatMessages(7, 30);
    expect(axiosInstance.get).toHaveBeenCalledWith('/api/chats/rooms/7/messages', { params: { before: 30, size: 30 } });
    expect(messages[0].createdAt).toBeInstanceOf(Date);

    expect(await fetchChatUnreadCount()).toBe(4);
    await readChatRoom(7, 3);
    expect(axiosInstance.patch).toHaveBeenCalledWith('/api/chats/rooms/7/read', { lastMessageId: 3 });
    expect((await changeChatStatus(7, 'RESOLVED')).status).toBe('RESOLVED');
  });

  it('실시간 주소 — 배포는 api 주소 직접, 로컬은 같은 호스트(Vite 프록시)', () => {
    expect(chatSocketUrl(true)).toBe('wss://api.gotgan.click/ws/chat');
    expect(chatSocketUrl(false, { protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/ws/chat');
    expect(chatSocketUrl(false, { protocol: 'https:', host: 'preview.app' })).toBe('wss://preview.app/ws/chat');
    expect(chatSocketUrl()).toMatch(/^wss?:\/\//);
  });
});

describe('chatView', () => {
  it('내 자리 — 상대와 방 종류로', () => {
    expect(mySide(ROOM)).toBe('BUYER');
    expect(mySide({ type: 'STORE_INQUIRY', counterpart: { role: 'BUYER' } })).toBe('SELLER');
    expect(mySide({ type: 'SELLER_SUPPORT', counterpart: { role: 'ADMIN' } })).toBe('SELLER');
    expect(mySide({ type: 'BUYER_SUPPORT', counterpart: { role: 'ADMIN' } })).toBe('BUYER');
    expect(mySide({ type: 'SELLER_SUPPORT', counterpart: { role: 'SELLER' } })).toBe('ADMIN');
    expect(mySide({ type: 'BUYER_SUPPORT', counterpart: { role: 'BUYER' } })).toBe('ADMIN');
  });

  it('실시간 프레임 → 메시지 (mine 계산) · 맨 앞에 넣기(중복 무시) · 화면 순서', () => {
    const live = frameToMessage({ type: 'MESSAGE', messageId: 4, roomId: 7, senderRole: 'SELLER', kind: 'TEXT', content: '네', context: null, createdAt: '2026-10-27T10:01:00+09:00' }, 'BUYER');
    expect(live).toMatchObject({ messageId: 4, mine: false });
    expect(live.createdAt).toBeInstanceOf(Date);

    const data = { pages: [[MESSAGE], [{ ...MESSAGE, messageId: 1 }]], pageParams: [undefined, 3] };
    const added = prependMessage(data, live);
    expect(added.pages[0].map((m) => m.messageId)).toEqual([4, 3]);
    expect(prependMessage(added, live)).toBe(added);
    expect(prependMessage(undefined, live)).toBeUndefined();
    expect(prependMessage({ pages: [], pageParams: [] }, live).pages).toEqual([[live]]);
    expect(flattenMessages(added).map((m) => m.messageId)).toEqual([1, 3, 4]);
    expect(flattenMessages(undefined)).toEqual([]);
  });

  it('보내기 전 확인 · 종료 안내', () => {
    expect(validateContent('   ')).toBe('메시지를 입력해 주세요.');
    expect(validateContent('가'.repeat(1001))).toMatch('1,000자');
    expect(validateContent('  안녕  ')).toBeNull();
    expect(roomNotice({ status: 'RESOLVED' }, 'ADMIN')).toMatch('다시 열거나');
    expect(roomNotice({ status: 'RESOLVED' }, 'BUYER')).toMatch('다시 열려요');
    expect(roomNotice({ status: 'OPEN' }, 'BUYER')).toBeNull();
  });
});
