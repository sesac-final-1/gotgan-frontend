// 1:1 채팅 API — 담당 구지훈. 게이트웨이 /api/chats/** → chat-service (backend #124 · #125, chat.md 1~5절)
import { axiosInstance } from '@/shared/api/axiosInstance';

// 메시지 { messageId, roomId, senderRole, mine, kind, content, context, createdAt(+09:00) } → createdAt 은 Date
export const toMessage = (m) => ({ ...m, createdAt: new Date(m.createdAt) });
// 방 { roomId, type, status, counterpart, storeId, buyerId, lastMessage: { preview, at } | null, unreadCount, createdAt }
export const toRoom = (r) => ({ ...r, lastMessage: r.lastMessage && { ...r.lastMessage, at: new Date(r.lastMessage.at) } });

export const PAGE_SIZE = 30;

// POST /api/chats/rooms { type, storeId?, context?: { type, id } } → 방 (처음 201 · 있던 방 200)
export const openChatRoom = async (body) => toRoom((await axiosInstance.post('/api/chats/rooms', body)).data.data);

// GET /api/chats/rooms?type=&status= → 최근 메시지순 (페이징 없음)
export const fetchChatRooms = async ({ type, status } = {}) =>
  (await axiosInstance.get('/api/chats/rooms', { params: { type, status } })).data.data.map(toRoom);

// GET /api/chats/rooms/{id}/messages?before=&size= → 최신 → 과거
export const fetchChatMessages = async (roomId, before) =>
  (await axiosInstance.get(`/api/chats/rooms/${roomId}/messages`, { params: { before, size: PAGE_SIZE } })).data.data.map(toMessage);

// PATCH /api/chats/rooms/{id}/read { lastMessageId } → 204
export const readChatRoom = async (roomId, lastMessageId) => axiosInstance.patch(`/api/chats/rooms/${roomId}/read`, { lastMessageId });

// GET /api/chats/unread-count → { count }
export const fetchChatUnreadCount = async () => (await axiosInstance.get('/api/chats/unread-count')).data.data.count;

// PATCH /api/chats/rooms/{id}/status { status: OPEN | RESOLVED } — 관리자 · 상담방만
export const changeChatStatus = async (roomId, status) =>
  toRoom((await axiosInstance.patch(`/api/chats/rooms/${roomId}/status`, { status })).data.data);

// 실시간(STOMP) 주소 — 배포는 api.gotgan.click 에 직접(Vercel 은 WebSocket 을 중계하지 않음, 게이트웨이가 이 경로만 Origin 허용), 로컬은 Vite 프록시
export const chatSocketUrl = (prod = import.meta.env.PROD, loc = window.location) =>
  prod ? 'wss://api.gotgan.click/ws/chat' : `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws/chat`;
