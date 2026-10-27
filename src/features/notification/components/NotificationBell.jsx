// 헤더 알림 벨 — 담당 구지훈. 쇼핑몰 · 판매자센터 · 관리자 헤더 공용 (dark = 콘솔 먹색 헤더)
// 안 읽은 수 + 펼치면 최신 20개, 누르면 읽음 처리 후 그 화면으로. 실시간 연결(SSE)은 벨이 있는 동안 하나
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell } from 'lucide-react';
import { useNotificationStream } from '@/features/notification/hooks/useNotificationStream';
import { useNotificationsQuery } from '@/features/notification/hooks/useNotificationsQuery';
import { useReadNotificationMutation } from '@/features/notification/hooks/useReadNotificationMutation';
import { useUnreadCountQuery } from '@/features/notification/hooks/useUnreadCountQuery';
import { ago } from '@/features/notification/utils/ago';
import { cx } from '@/shared/utils/format';

export default function NotificationBell({ dark = false }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const nav = useNavigate();
  useNotificationStream();
  const { data: unread = 0 } = useUnreadCountQuery();
  const { data, isLoading } = useNotificationsQuery(open);
  const read = useReadNotificationMutation();

  useEffect(() => { // 바깥을 누르면 닫기
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const go = (n) => {
    if (!n.read) read.mutate(n.id);
    setOpen(false);
    if (n.link) void nav(n.link);
  };

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen(!open)} className="relative p-1" aria-label={`알림 ${unread}개`}>
        <Bell size={dark ? 19 : 22} strokeWidth={1.6} />
        {unread > 0 && <span className="absolute -right-1 -top-0.5 min-w-4 h-4 px-1 bg-point text-white text-[10px] font-bold flex items-center justify-center rounded-full num">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 max-w-[calc(100vw-32px)] bg-white text-ink border border-line shadow-xl">
          <div className="px-4 h-11 flex items-center border-b border-line font-bold text-sm">
            알림 <span className="ml-1.5 text-point num">{unread}</span>
            {unread > 0 && <button onClick={() => read.mutate(undefined)} className="ml-auto text-[12px] font-normal text-mute hover:text-ink">모두 읽음</button>}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading && <p className="px-4 py-6 text-center text-[13px] text-mute">불러오는 중…</p>}
            {data?.items.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={cx('block w-full text-left px-4 py-3 border-b border-line hover:bg-cream', !n.read && 'bg-point/5')}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-point shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug">{n.title}</div>
                    {n.body && <div className="text-[12.5px] text-ink-2 leading-snug mt-0.5 break-words">{n.body}</div>}
                    <div className="text-[11px] text-mute mt-1">{ago(n.createdAt)}</div>
                  </div>
                </div>
              </button>
            ))}
            {data && !data.items.length && <p className="px-4 py-8 text-center text-[13px] text-mute">새 알림이 없어요</p>}
          </div>
        </div>
      )}
    </div>
  );
}
