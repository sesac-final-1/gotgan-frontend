import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Empty, Segments } from '@/shared/components/ui';
import { cx } from '@/shared/utils/format';
import { useChatRoomsQuery } from '@/features/chat/hooks/useChatQueries';
import ChatRoomPanel from '@/features/chat/components/ChatRoomPanel';
import { ROOM_TYPE_LABEL } from '@/features/chat/utils/chatView';

// 화면마다 보는 방 종류 탭 — 구매자: 스토어 톡 · 고객센터 / 판매자: 스토어 톡 · 운영 상담 / 관리자: 상담방 2종 (+ 처리 대기)
const TABS = {
  buyer: [['전체', {}], ['스토어 톡', { type: 'STORE_INQUIRY' }], ['고객센터', { type: 'BUYER_SUPPORT' }]],
  seller: [['전체', {}], ['스토어 톡', { type: 'STORE_INQUIRY' }], ['운영 상담', { type: 'SELLER_SUPPORT' }]],
  admin: [['처리 대기', { status: 'OPEN' }], ['판매자 상담', { type: 'SELLER_SUPPORT' }], ['고객 상담', { type: 'BUYER_SUPPORT' }], ['종료', { status: 'RESOLVED' }]],
};
const when = (d) => (d ? d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '');

/** 채팅함 — 왼쪽 방 목록 · 오른쪽 열린 방(/…/chats/:roomId). 좁은 화면은 하나씩 */
export default function ChatInbox({ kind, basePath }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(TABS[kind][0][0]);
  const filter = Object.fromEntries(TABS[kind])[tab];
  const { data: rooms = [], isLoading } = useChatRoomsQuery(filter);
  const { data: allRooms = [], isSuccess } = useChatRoomsQuery({}); // 열린 방은 탭과 상관없이 찾는다
  const found = allRooms.find((r) => String(r.roomId) === roomId);
  // 관리자 목록엔 스토어 톡이 없다 — 도움 요청 카드로 들어온 방은 읽기 전용으로 연다(서버가 권한 확인, 아니면 404)
  const readOnlyRoom = isSuccess && !found && kind === 'admin' && roomId
    ? { roomId: Number(roomId), type: 'STORE_INQUIRY', status: null, counterpart: { name: `스토어 톡 #${roomId}`, role: 'SELLER' } }
    : null;
  const open = found ?? readOnlyRoom;

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[480px]">
      <aside className={cx('flex flex-col min-h-0 border border-line bg-white', roomId && 'hidden lg:flex')}>
        <div className="p-3 border-b border-line overflow-x-auto"><Segments items={TABS[kind].map(([t]) => t)} value={tab} onChange={setTab} /></div>
        <ul className="flex-1 overflow-y-auto">
          {isLoading && <li className="p-6 text-center text-mute text-sm">불러오는 중…</li>}
          {!isLoading && rooms.length === 0 && <li><Empty title="대화가 없어요" /></li>}
          {rooms.map((r) => (
            <li key={r.roomId}>
              <Link to={`${basePath}/${r.roomId}`}
                className={cx('flex gap-3 px-4 py-3 border-b border-line hover:bg-cream', String(r.roomId) === roomId && 'bg-cream')}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold truncate">{r.counterpart.name}</span>
                    <span className="text-[11px] text-mute shrink-0">{ROOM_TYPE_LABEL[r.type]}</span>
                  </div>
                  <p className="text-[12.5px] text-ink-2 truncate mt-0.5">{r.lastMessage?.preview ?? '대화를 시작해 보세요'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[11px] text-mute">{when(r.lastMessage?.at)}</span>
                  {r.unreadCount > 0 && <span className="min-w-5 h-5 px-1.5 bg-point text-white text-[11px] font-bold flex items-center justify-center num">{r.unreadCount}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <div className={cx('min-h-0', !roomId && 'hidden lg:block')}>
        {open ? <ChatRoomPanel key={open.roomId} room={open} basePath={basePath} side={readOnlyRoom ? 'ADMIN' : undefined} onBack={() => navigate(basePath)} />
          : <div className="h-full border border-line bg-white flex items-center justify-center text-mute text-sm">
              {roomId ? '대화방을 찾을 수 없어요.' : '왼쪽에서 대화를 고르세요.'}
            </div>}
      </div>
    </div>
  );
}
