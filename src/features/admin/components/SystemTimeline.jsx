import { serviceShortName } from '@/features/admin/constants';
import { useSystemEventsQuery } from '@/features/admin/hooks/useSystemQueries';

// 타임라인 — 담당 박지연. 내린 시각 · 복구 시각 · 걸린 시간, 최신순(서버 순서 그대로). 실패해도 받은 값은 그대로 보여 준다. 한 화면에 들어오게 높이를 고정하고 많아지면 이 안에서만 스크롤
// 시나리오로 내린 기록은 서버가 사유를 「시나리오 — …」 로 남겨 표시로 구분한다
// en-GB: 언어와 상관없이 24시간 HH:mm:ss 로 나온다(ko-KR 은 14시 3분 11초)
const clock = (iso) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul' });

function EventRow({ event }) {
  const scope = event.scope === 'ONE' ? '1개' : '전부';
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-2 border-t border-line first:border-t-0 text-lg tabular-nums">
      <span>{clock(event.killedAt)}</span>
      <span className="font-bold">{serviceShortName(event.service)}</span>
      <span>{scope} 내림</span>
      {event.reason?.startsWith('시나리오') && <span className="px-1.5 text-sm font-bold bg-sand text-ink-2">시나리오</span>}
      {event.recoveredAt ? (
        <span className="text-moss font-bold">→ {clock(event.recoveredAt)} 복구 · {event.recoverySeconds}초</span>
      ) : (
        <span className="text-sky font-bold">→ 복구 기다리는 중</span>
      )}
    </li>
  );
}

export default function SystemTimeline() {
  const { data: events, isError } = useSystemEventsQuery();
  return (
    <section aria-label="타임라인" className="border border-line bg-paper p-4">
      <h2 className="text-lg font-bold mb-1">타임라인</h2>
      {events?.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto">{events.map((e) => <EventRow key={e.eventId} event={e} />)}</ul>
      ) : (
        <p className="py-2 text-sm text-mute">{isError ? '타임라인을 불러오지 못했어요.' : '아직 내린 서비스가 없어요.'}</p>
      )}
    </section>
  );
}
