import { useState } from 'react';
import LoadTestChart from '@/features/admin/components/LoadTestChart';
import SystemTraceModal from '@/features/admin/components/SystemTraceModal';
import { serviceShortName } from '@/features/admin/constants';
import {
  useMonitorCallsQuery, useMonitorErrorsQuery, useMonitorOverviewQuery, useMonitorSummaryQuery,
} from '@/features/admin/hooks/useSystemQueries';
import { formatClock, hasErrors, isLatencySpike, isServerError } from '@/features/admin/monitor';

// 실시간 모니터링(11/16 피드백) — 담당 구지훈. 부하테스트와 상관없이 실제 트래픽을 항상 보여 준다(계약 backend admin.md 9절).
// 그래프는 서버 지표(5초 수집), 호출 · 장애는 원본 데이터라 1초마다 바로 반응. 에러가 하나라도 있거나 응답이 치솟으면 빨간 배경
const TABS = [
  { key: 'overview', label: '총 현황' },
  { key: 'services', label: '서비스별' },
  { key: 'calls', label: '호출' },
  { key: 'errors', label: '장애' },
  { key: 'summary', label: '분석' },
];

const fmtRps = (v) => `${v.toFixed(1)}건`;
const fmtMs = (v) => `${v.toFixed(0)}ms`;
const fmtRate = (v) => `${(v * 100).toFixed(1)}%`;

function SeriesCharts({ series, compact = false }) {
  const errors = hasErrors(series?.errorRate);
  const spike = isLatencySpike(series?.avgMs);
  return (
    <>
      <LoadTestChart label="초당 요청" points={series?.rps} floor={compact ? 1 : 5} format={fmtRps} compact={compact} />
      <LoadTestChart label="평균 응답" points={series?.avgMs} floor={100} format={fmtMs} alert={spike} alertText="급등" compact={compact} />
      <LoadTestChart label="에러율 (5xx)" points={series?.errorRate} floor={0.05} format={fmtRate} alert={errors} alertText="장애" compact={compact} />
    </>
  );
}

function OverviewTab({ overview }) {
  const pools = (overview?.services ?? []).filter((s) => s.db);
  const active = pools.reduce((n, s) => n + s.db.active, 0);
  const pending = pools.reduce((n, s) => n + s.db.pending, 0);
  const max = pools.reduce((n, s) => n + s.db.max, 0);
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <SeriesCharts series={overview?.total} />
      <div className={`border px-3 py-2 ${pending > 0 ? 'border-rust bg-rust-soft' : 'border-line bg-paper'}`} aria-label="DB 연결">
        <span className={`text-sm ${pending > 0 ? 'text-rust font-bold' : 'text-mute'}`}>DB 연결 (전체){pending > 0 ? ' · 대기 발생' : ''}</span>
        <p className="text-xl font-bold tabular-nums mt-1">{active} / {max}</p>
        <p className="text-sm text-mute">사용 중 / 최대 · 대기 {pending}</p>
      </div>
    </div>
  );
}

function ServicesTab({ overview }) {
  return (
    <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-3" aria-label="서비스별 현황">
      {(overview?.services ?? []).map((s) => {
        const bad = hasErrors(s.series.errorRate) || isLatencySpike(s.series.avgMs);
        return (
          <li key={s.name} className={`border-2 p-2 ${bad ? 'border-rust' : 'border-line'}`}>
            <div className="flex items-center justify-between mb-1">
              <b className={`text-lg ${bad ? 'text-rust' : ''}`}>{serviceShortName(s.name)}</b>
              <span className="text-sm text-mute">
                {s.db ? `DB ${s.db.active}/${s.db.max}${s.db.pending ? ` · 대기 ${s.db.pending}` : ''}` : 'DB 없음'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1"><SeriesCharts series={s.series} compact /></div>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ text }) {
  return <p className="py-6 text-center text-sm text-mute">{text}</p>;
}

function CallsTab({ onTrace }) {
  const { data = [] } = useMonitorCallsQuery(true);
  if (data.length === 0) return <Empty text="최근 1분 동안 들어온 요청이 없어요." />;
  return (
    <table className="tbl" aria-label="최근 호출">
      <thead><tr><th>시각</th><th>API</th><th>서비스</th><th>상태</th><th className="text-right">소요</th></tr></thead>
      <tbody>
        {data.map((c) => {
          const bad = isServerError(c.status);
          return (
            <tr key={c.traceId} onClick={() => onTrace(c.traceId)} className={`cursor-pointer ${bad ? 'text-rust font-bold' : ''}`}
              style={bad ? { boxShadow: 'inset 4px 0 0 var(--color-rust)' } : undefined} data-error={bad || undefined}>
              <td className="tabular-nums whitespace-nowrap">{formatClock(c.timestampMs)}</td>
              <td className="break-all">{c.method} {c.path}</td>
              <td>{c.service ? serviceShortName(c.service) : '-'}</td>
              <td className="tabular-nums">{c.status ?? '-'}</td>
              <td className="text-right tabular-nums">{c.durationMs}ms</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ErrorsTab({ onTrace }) {
  const { data = [] } = useMonitorErrorsQuery(true);
  if (data.length === 0) return <Empty text="최근 10분 동안 장애가 없어요." />;
  return (
    <table className="tbl" aria-label="최근 장애">
      <thead><tr><th>시각</th><th>구분</th><th>서비스</th><th>내용</th><th>상태</th></tr></thead>
      <tbody>
        {data.map((e) => {
          const bad = e.kind === 'RESPONSE' || e.level === 'ERROR';
          return (
            <tr key={`${e.kind}-${e.timestampMs}-${e.traceId ?? e.title}`} onClick={() => e.traceId && onTrace(e.traceId)}
              className={`${e.traceId ? 'cursor-pointer' : ''} ${bad ? 'text-rust font-bold' : ''}`}
              style={bad ? { boxShadow: 'inset 4px 0 0 var(--color-rust)' } : undefined} data-error={bad || undefined}>
              <td className="tabular-nums whitespace-nowrap">{formatClock(e.timestampMs)}</td>
              <td className="whitespace-nowrap">{e.kind === 'RESPONSE' ? '5xx 응답' : `로그 ${e.level}`}</td>
              <td>{e.service ? serviceShortName(e.service) : '-'}</td>
              <td className="break-all">{e.title}</td>
              <td className="tabular-nums">{e.status ?? '-'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SummaryTab() {
  const { data } = useMonitorSummaryQuery(true);
  const total = (data?.statuses ?? []).reduce((n, s) => n + s.count, 0);
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <section aria-label="에러가 많은 API">
        <h3 className="font-bold mb-2">에러가 많은 API (5분)</h3>
        {data?.topErrors?.length ? (
          <ol className="grid gap-1 text-sm">
            {data.topErrors.map((e) => (
              <li key={`${e.service}-${e.api}-${e.status}`} className="flex justify-between gap-2 text-rust font-bold">
                <span className="break-all">{serviceShortName(e.service)} · {e.api} · {e.status}</span><span className="tabular-nums">{e.count}건</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-mute">5xx 없음</p>}
      </section>
      <section aria-label="느린 API">
        <h3 className="font-bold mb-2">느린 API (평균, 5분)</h3>
        {data?.slowest?.length ? (
          <ol className="grid gap-1 text-sm">
            {data.slowest.map((s) => (
              <li key={`${s.service}-${s.api}`} className="flex justify-between gap-2">
                <span className="break-all">{serviceShortName(s.service)} · {s.api}</span><span className="tabular-nums">{s.avgMs}ms</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-mute">-</p>}
      </section>
      <section aria-label="상태 코드 분포">
        <h3 className="font-bold mb-2">상태 코드 (5분)</h3>
        {total ? (
          <ul className="grid gap-1 text-sm">
            {data.statuses.map((s) => (
              <li key={s.status} className={`grid grid-cols-[44px_1fr_64px] gap-2 items-center ${s.status.startsWith('5') ? 'text-rust font-bold' : ''}`}>
                <span className="tabular-nums">{s.status}</span>
                <span className="h-2 bg-sand"><span className={`block h-2 ${s.status.startsWith('5') ? 'bg-rust' : 'bg-ink'}`} style={{ width: `${(s.count / total) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{s.count}건</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-mute">-</p>}
      </section>
    </div>
  );
}

export default function SystemMonitorPanel() {
  const [tab, setTab] = useState('overview');
  const [traceId, setTraceId] = useState(null);
  const { data: overview } = useMonitorOverviewQuery();
  const alerting = hasErrors(overview?.total?.errorRate);

  return (
    <section aria-label="실시간 모니터링" className="panel">
      <div className="panel-head">
        <h2 className="panel-title">실시간 모니터링 {alerting && <span className="ml-2 px-2 py-0.5 text-sm bg-rust text-white">장애 감지</span>}</h2>
        <span className="text-sm text-mute">실제 트래픽 기준 · 그래프 5초 · 호출 / 장애 1초</span>
      </div>
      <div role="tablist" className="flex gap-5 px-5 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'tab-on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-5 py-4">
        {tab === 'overview' && <OverviewTab overview={overview} />}
        {tab === 'services' && <ServicesTab overview={overview} />}
        {tab === 'calls' && <CallsTab onTrace={setTraceId} />}
        {tab === 'errors' && <ErrorsTab onTrace={setTraceId} />}
        {tab === 'summary' && <SummaryTab />}
      </div>
      {traceId && <SystemTraceModal traceId={traceId} onClose={() => setTraceId(null)} />}
    </section>
  );
}
