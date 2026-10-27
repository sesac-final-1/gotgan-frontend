import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Pill } from '@/shared/components/ui';
import { cx } from '@/shared/utils/format';
import { toast } from '@/shared/stores/toastStore';
import { useChangeChatStatusMutation, useChatMessagesQuery, useOpenChatMutation, useReadChatMutation } from '@/features/chat/hooks/useChatQueries';
import { useChatRoomSocket } from '@/features/chat/hooks/useChatRoomSocket';
import { contextLabel, flattenMessages, MAX_LENGTH, mySide, ROOM_TYPE_LABEL, roomNotice, validateContent } from '@/features/chat/utils/chatView';

const CONNECTION_TEXT = { connecting: '연결 중…', disconnected: '연결이 끊겼어요. 다시 연결하는 중…', stopped: '실시간 연결이 멈췄어요. 새로고침해 주세요.' };
const time = (d) => d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 열린 방 — 메시지 목록(위로 더 보기) · 입력 · 상담 상태(관리자). 화면에 있는 동안만 실시간 구독 */
/** side: 내 자리를 직접 줄 때(관리자의 도움 요청 스토어 톡 열람) — 없으면 방에서 계산 */
export default function ChatRoomPanel({ room, basePath, onBack, side: sideOverride }) {
  const side = sideOverride ?? mySide(room);
  const navigate = useNavigate();
  const messagesQuery = useChatMessagesQuery(room.roomId);
  const messages = useMemo(() => flattenMessages(messagesQuery.data), [messagesQuery.data]);
  const { status, send, notifyTyping, counterpartReadId, counterpartTyping } = useChatRoomSocket(room.roomId, side);
  const read = useReadChatMutation();
  const changeStatus = useChangeChatStatusMutation();
  const openHelp = useOpenChatMutation();
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const lastId = messages.at(-1)?.messageId;
  const lastMineId = messages.findLast((m) => m.mine)?.messageId;
  const readOnly = side === 'ADMIN' && room.type === 'STORE_INQUIRY';

  // 새 메시지가 보이면 맨 아래로 + 읽음 (탭이 보일 때만)
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lastId]);
  useEffect(() => {
    if (lastId && !readOnly && document.visibilityState === 'visible') read.mutate({ roomId: room.roomId, lastMessageId: lastId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마지막 메시지가 바뀔 때만
  }, [room.roomId, lastId]);

  const submit = () => {
    const error = validateContent(text);
    if (error) return toast(error);
    if (!send(text)) return toast('연결 중이에요. 잠시 뒤 다시 보내 주세요.');
    setText('');
  };
  const askHelp = () => openHelp.mutate({ type: 'BUYER_SUPPORT', context: { type: 'CHAT_ROOM', id: room.roomId } }, {
    onSuccess: (help) => navigate(`${basePath}/${help.roomId}`),
  });

  return (
    <section className="flex flex-col h-full min-h-0 bg-white border border-line">
      <header className="flex items-center gap-2 px-4 h-14 border-b border-line shrink-0">
        {onBack && <button className="btn btn-ghost btn-xs lg:hidden" onClick={onBack}>← 목록</button>}
        <div className="min-w-0">
          <div className="font-bold truncate">{room.counterpart.name}</div>
          <div className="text-[11.5px] text-mute">{ROOM_TYPE_LABEL[room.type]}</div>
        </div>
        {room.status && <Pill tone={room.status === 'OPEN' ? 'sky' : 'mute'} className="ml-1">{room.status === 'OPEN' ? '상담 중' : '종료'}</Pill>}
        {readOnly && <Pill tone="amber" className="ml-1">읽기 전용</Pill>}
        <div className="ml-auto flex gap-2">
          {side === 'BUYER' && room.type === 'STORE_INQUIRY' && (
            <button className="btn btn-line btn-xs" disabled={openHelp.isPending} onClick={askHelp}>운영팀에 도움 요청</button>
          )}
          {side === 'ADMIN' && room.status && (
            <button className="btn btn-line btn-xs" disabled={changeStatus.isPending}
              onClick={() => changeStatus.mutate({ roomId: room.roomId, status: room.status === 'OPEN' ? 'RESOLVED' : 'OPEN' })}>
              {room.status === 'OPEN' ? '상담 종료' : '다시 열기'}
            </button>
          )}
        </div>
      </header>

      {CONNECTION_TEXT[status] && <div className="px-4 py-1.5 text-[12px] bg-amber-soft text-amber shrink-0">{CONNECTION_TEXT[status]}</div>}

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-cream">
        {messagesQuery.hasNextPage && (
          <div className="text-center">
            <button className="btn btn-ghost btn-xs" disabled={messagesQuery.isFetchingNextPage} onClick={() => messagesQuery.fetchNextPage()}>이전 메시지 더 보기</button>
          </div>
        )}
        {messagesQuery.isLoading && <p className="text-center text-mute text-sm py-10">불러오는 중…</p>}
        {!messagesQuery.isLoading && messages.length === 0 && <p className="text-center text-mute text-sm py-10">첫 메시지를 보내 보세요.</p>}
        {messages.map((m) => <MessageItem key={m.messageId} m={m} basePath={basePath} read={m.messageId === lastMineId && counterpartReadId >= m.messageId} />)}
      </div>

      {counterpartTyping && <div className="px-4 py-1 text-[12px] text-mute shrink-0">{room.counterpart.name} 님이 입력 중…</div>}
      {roomNotice(room, side) && <div className="px-4 py-1.5 text-[12px] text-mute border-t border-line shrink-0">{roomNotice(room, side)}</div>}
      {readOnly ? (
        <div className="px-4 py-3 text-[13px] text-mute border-t border-line">구매자가 도움을 요청한 스토어 톡이에요. 관리자는 읽기만 할 수 있어요.</div>
      ) : (
        <div className="flex gap-2 p-3 border-t border-line shrink-0">
          <textarea value={text} maxLength={MAX_LENGTH} rows={2} placeholder="메시지 입력 (Enter 보내기 · Shift+Enter 줄바꿈)"
            className="flex-1 resize-none border border-line-2 px-3 py-2 text-[14px] outline-none focus:border-ink"
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.trim()) notifyTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }} />
          <div className="flex flex-col items-end justify-between">
            <span className="text-[11px] text-mute num">{text.length}/{MAX_LENGTH}</span>
            <button className="btn btn-ink btn-sm" onClick={submit}>보내기</button>
          </div>
        </div>
      )}
    </section>
  );
}

function MessageItem({ m, read, basePath }) {
  if (m.kind === 'SYSTEM') return <p className="text-center text-[12px] text-mute py-1">{m.content}</p>;
  if (m.kind === 'CONTEXT') {
    return (
      <div className={cx('flex', m.mine ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[80%] border border-line-2 bg-white px-3 py-2">
          <div className="text-[11px] text-mute">{contextLabel(m.context?.type)}</div>
          <div className="text-[13.5px] font-semibold">{m.context?.title ?? m.content}</div>
          {m.context?.type === 'CHAT_ROOM' && basePath === '/admin/chats' && (
            <Link to={`${basePath}/${m.context.id}`} className="text-[12px] text-point underline">대화 보기 (읽기 전용)</Link>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={cx('flex items-end gap-1.5', m.mine ? 'justify-end' : 'justify-start')}>
      {m.mine && <span className="text-[10.5px] text-mute whitespace-nowrap">{read && <b className="text-point mr-1">읽음</b>}{time(m.createdAt)}</span>}
      <p className={cx('max-w-[75%] px-3 py-2 text-[14px] whitespace-pre-wrap break-words', m.mine ? 'bg-ink text-white' : 'bg-white border border-line')}>{m.content}</p>
      {!m.mine && <span className="text-[10.5px] text-mute whitespace-nowrap">{time(m.createdAt)}</span>}
    </div>
  );
}
