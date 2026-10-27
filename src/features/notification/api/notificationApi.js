// 알림 센터 API — 담당 구지훈. 게이트웨이 /api/notifications/** → admin-service (backend #119 · #120, admin.md 5절)
import { axiosInstance } from '@/shared/api/axiosInstance';

// 응답 항목 { id, type, title, body, link, read, createdAt(+09:00) } → 화면 필드 (createdAt 은 Date)
export const toNotification = (n) => ({ ...n, createdAt: new Date(n.createdAt) });

// GET /api/notifications?cursor=&size= → { items[], nextCursor, unreadCount } — 최신순 (회원 + 판매자면 스토어 + 관리자면 관리자 전원 알림)
export const fetchNotifications = async (cursor) => {
  const data = (await axiosInstance.get('/api/notifications', { params: { cursor, size: 20 } })).data.data;
  return { ...data, items: data.items.map(toNotification) };
};

// GET /api/notifications/unread-count → { count }
export const fetchUnreadCount = async () => (await axiosInstance.get('/api/notifications/unread-count')).data.data.count;

// PATCH /api/notifications/{id}/read — 내 알림이 아니면 404
export const readNotification = async (id) => axiosInstance.patch(`/api/notifications/${id}/read`);

// PATCH /api/notifications/read-all → { count }
export const readAllNotifications = async () => (await axiosInstance.patch('/api/notifications/read-all')).data.data.count;

// 실시간(SSE) 주소 — 배포는 api.gotgan.click 에 직접(Vercel rewrite 는 장시간 스트리밍에 맞지 않음, 게이트웨이가 이 경로만 CORS 허용), 로컬은 Vite 프록시
export const NOTIFICATION_STREAM_URL = `${import.meta.env.PROD ? 'https://api.gotgan.click' : ''}/api/notifications/stream`;
