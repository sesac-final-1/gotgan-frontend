import { Modal } from '@/shared/components/ui';
import { serviceShortName } from '@/features/admin/constants';
import { useMonitorTraceQuery } from '@/features/admin/hooks/useSystemQueries';

// 트레이스 한 건 — 요청이 거친 서비스와 구간별 시간을 막대로(Zipkin). 담당 구지훈(11/16). 장애 구간은 빨간 막대
export default function SystemTraceModal({ traceId, onClose }) {
  const { data, isPending, isError } = useMonitorTraceQuery(traceId);
  const total = Math.max(data?.durationMs ?? 0, 1);

  return (
    <Modal open={!!traceId} onClose={onClose} title="트레이스" width={760}>
      <p className="text-sm text-mute break-all">traceId {traceId}{data ? ` · 전체 ${data.durationMs}ms` : ''}</p>
      {isPending && <p className="mt-3 text-sm text-mute">불러오는 중...</p>}
      {(isError || (data && data.spans.length === 0)) && (
        <p className="mt-3 text-sm text-mute">트레이스를 찾지 못했어요. Zipkin 은 메모리 저장이라 부하 중엔 몇 분 지나면 밀려나요.</p>
      )}
      {data?.spans.length > 0 && (
        <ol className="mt-3 grid gap-1" aria-label="구간">
          {data.spans.map((s) => (
            <li key={s.id} className="grid grid-cols-[96px_1fr] gap-2 items-center text-sm">
              <span className={`font-bold truncate ${s.error ? 'text-rust' : ''}`}>{serviceShortName(s.service ?? '-')}</span>
              <div className="min-w-0">
                <div className="flex justify-between gap-2">
                  <span className={`truncate ${s.error ? 'text-rust' : 'text-ink-2'}`}>{s.name}{s.status ? ` · ${s.status}` : ''}</span>
                  <span className="tabular-nums shrink-0">{s.durationMs}ms</span>
                </div>
                <div className="relative h-2 bg-sand">
                  <span className={`absolute inset-y-0 ${s.error ? 'bg-rust' : 'bg-ink'}`}
                    style={{ left: `${(s.startMs / total) * 100}%`, width: `${Math.max(0.5, (s.durationMs / total) * 100)}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
