// 채팅 화면 계산 — 담당 구지훈 (chat.md "방 3종류")

export const ROOM_TYPE_LABEL = { STORE_INQUIRY: '스토어 톡', SELLER_SUPPORT: '판매자 운영 상담', BUYER_SUPPORT: '고객센터 1:1 상담' };
export const MAX_LENGTH = 1000;

/** 이 방에서 내 자리 — 상대(counterpart.role)와 방 종류로 정한다 (실시간 프레임엔 mine 이 없어 화면이 판단) */
export function mySide(room) {
  const other = room?.counterpart?.role;
  if (other === 'ADMIN') return room.type === 'SELLER_SUPPORT' ? 'SELLER' : 'BUYER';
  if (room?.type === 'STORE_INQUIRY') return other === 'BUYER' ? 'SELLER' : 'BUYER';
  return 'ADMIN';
}

/** 실시간 MESSAGE 프레임 → 3절 메시지 모양 (mine 계산) */
export const frameToMessage = (frame, side) => ({
  messageId: frame.messageId, roomId: frame.roomId, senderRole: frame.senderRole, mine: frame.senderRole === side,
  kind: frame.kind, content: frame.content, context: frame.context, createdAt: new Date(frame.createdAt),
});

/** 무한 목록(최신 페이지가 앞) 맨 앞에 새 메시지 — 이미 있으면(재연결 뒤 REST 와 겹침) 그대로 */
export function prependMessage(data, message) {
  if (!data) return data;
  if (data.pages.some((p) => p.some((m) => m.messageId === message.messageId))) return data;
  const [first = [], ...rest] = data.pages;
  return { ...data, pages: [[message, ...first], ...rest] };
}

/** 화면 순서(과거 → 최신)로 펼치기 */
export const flattenMessages = (data) => (data?.pages ?? []).flat().slice().reverse();

/** 보내기 전 확인 — 앞뒤 공백 제거 후 1~1,000자 (서버와 같은 규칙, 개행 정리는 서버가) */
export function validateContent(text) {
  const trimmed = text.trim();
  if (!trimmed) return '메시지를 입력해 주세요.';
  if (trimmed.length > MAX_LENGTH) return `메시지는 ${MAX_LENGTH.toLocaleString()}자까지 보낼 수 있어요.`;
  return null;
}

/** 상담방 닫힘 · 읽기 전용 안내 */
export function roomNotice(room, side) {
  if (room?.status === 'RESOLVED') return side === 'ADMIN' ? '종료된 상담이에요. 다시 열거나 답장하면 이어집니다.' : '종료된 상담이에요. 메시지를 보내면 다시 열려요.';
  return null;
}
