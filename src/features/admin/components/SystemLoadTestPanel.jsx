import { useEffect, useState } from 'react';
import { toast } from '@/shared/stores/toastStore';
import LoadTestChart from '@/features/admin/components/LoadTestChart';
import { serviceShortName } from '@/features/admin/constants';
import { SCENARIO_SERVICES } from '@/features/admin/monitor';
import { SCENARIO_LABEL, failureCauses, formatCount, progress } from '@/features/admin/loadTest';
import {
  useLoadTestQuery, usePrepareAccountsMutation, useScaleLoadTestMutation, useStartLoadTestMutation, useStopLoadTestMutation,
} from '@/features/admin/hooks/useSystemQueries';

// 부하테스트 패널(11/16 시연, 11/17 결과 탭) — 담당 구지훈. 계약 backend admin.md 8절.
// 시나리오를 고르고 시작하면 클러스터 안 k6 가 부하를 보내고, 실행 중에는 슬라이더를 놓을 때마다 사용자 수를 바꾼다.
// 진행 막대(경과, 남은 시간)와 탭 두 개: 실시간(부하 그래프 + 지금까지 숫자), 결과(요청, 실패, 원인). 끝나도 그래프와 결과는 남는다
const SCENARIOS = [
  { value: 'BROWSE', label: '둘러보기 (조회)' },
  { value: 'REVIEWS', label: '리뷰 조회 폭주' },
  { value: 'CART', label: '장바구니 CRUD (계정 필요)' },
  { value: 'MIXED', label: '혼합 (둘러보기 70%, 장바구니 30%)' },
];
const DURATIONS = [60, 180, 300, 600];
const STATE_LABEL = { RUNNING: '실행 중', DONE: '완료', FAILED: '실패' };

const errorMessage = (err, fallback) => err.response?.data?.message ?? fallback;

/** 1초마다 다시 그려 경과, 남은 시간이 흐르게 */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function ProgressBar({ load, running }) {
  const now = useNow(running);
  const p = progress(load, now);
  return (
    <div className={`border px-4 py-3 ${running ? 'border-rust bg-rust-soft' : 'border-line bg-cream'}`} aria-label="진행 상태">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className={`font-bold ${running ? 'text-rust' : ''}`}>
          {running ? '부하테스트 진행 중' : `마지막 부하테스트 ${STATE_LABEL[load.state] ?? load.state}`}: {SCENARIO_LABEL[load.scenario] ?? load.scenario}, 시작 {load.vus}명
        </span>
        <span className="tabular-nums">경과 {p.elapsed} / {running ? `남은 시간 ${p.remaining}` : `최대 ${Math.round(load.durationSec / 60)}분`}</span>
      </div>
      <div className="mt-2 h-2 bg-paper" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-2 ${running ? 'bg-rust' : 'bg-ink-2'} transition-all`} style={{ width: `${p.percent}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className="border border-line px-3 py-2">
      <span className="text-sm text-mute">{label}</span>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function LiveTab({ series, result }) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="지금까지 요청" value={`${formatCount(result?.requests)}건`} />
        <Stat label="실패" value={`${formatCount(result?.failed)}건`} tone={result?.failed > 0 ? 'text-rust' : ''} />
        <Stat label="응답 시간 p95" value={result?.p95Ms == null ? '-' : `${Math.round(result.p95Ms)}ms`} />
        <Stat label="최대 동시 사용자" value={`${formatCount(result?.peakVus)}명`} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <LoadTestChart label="동시 사용자 (부하)" points={series.vus} floor={10} format={(v) => `${Math.round(v)}명`} />
        <LoadTestChart label="초당 요청 (부하)" points={series.rps} floor={10} format={(v) => `${v.toFixed(0)}건`} />
      </div>
    </div>
  );
}

function ResultTab({ result, running }) {
  if (!result) return <p className="text-mute">아직 부하테스트 기록이 없어요.</p>;
  return (
    <div className="grid gap-4" aria-label="부하테스트 결과">
      {running && <p className="text-sm text-mute">실행 중이라 지금까지의 값이에요. 끝나면 최종 결과로 바뀝니다.</p>}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Stat label="전체 요청" value={`${formatCount(result.requests)}건`} />
        <Stat label="실패" value={`${formatCount(result.failed)}건`} tone={result.failed > 0 ? 'text-rust' : 'text-moss'} />
        <Stat label="응답 시간 p95" value={result.p95Ms == null ? '-' : `${Math.round(result.p95Ms)}ms`} />
        <Stat label="평균 초당 요청" value={`${result.avgRps}건`} />
        <Stat label="최대 동시 사용자" value={`${formatCount(result.peakVus)}명`} />
        <Stat label="실행 시간" value={`${Math.floor(result.elapsedSec / 60)}분 ${result.elapsedSec % 60}초`} />
      </div>
      <div>
        <h3 className="font-bold mb-1">원인</h3>
        <ul className="list-disc pl-5 text-sm grid gap-0.5" aria-label="실패 원인">
          {failureCauses(result).map((line) => <li key={line} className={result.failed > 0 ? '' : 'text-moss'}>{line}</li>)}
        </ul>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-bold mb-1">상태 코드별</h3>
          <table className="w-full text-sm" aria-label="상태 코드별">
            <tbody>
              {Object.entries(result.byStatus).map(([status, n]) => (
                <tr key={status} className="border-b border-line">
                  <td className={`py-1 ${status.startsWith('2') ? '' : 'text-rust font-bold'}`}>{status}</td>
                  <td className="text-right tabular-nums">{formatCount(n)}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-bold mb-1">실패가 많은 API</h3>
          {result.topFailures.length === 0 ? <p className="text-sm text-mute">없음</p> : (
            <table className="w-full text-sm" aria-label="실패가 많은 API">
              <tbody>
                {result.topFailures.map((f) => (
                  <tr key={`${f.api}-${f.status}`} className="border-b border-line">
                    <td className="py-1">{f.api}</td><td className="text-rust">{f.status === '0' ? '연결 실패' : f.status}</td>
                    <td className="text-right tabular-nums">{formatCount(f.count)}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// scenario 는 화면이 들고 있어 아래 서비스 상태 카드에 같은 서비스를 강조한다
export default function SystemLoadTestPanel({ scenario = 'BROWSE', onScenarioChange = () => {} }) {
  const { data } = useLoadTestQuery();
  const start = useStartLoadTestMutation();
  const scale = useScaleLoadTestMutation();
  const stop = useStopLoadTestMutation();
  const accounts = usePrepareAccountsMutation();
  const [durationSec, setDurationSec] = useState(300);
  const [vus, setVus] = useState(50);
  const [tab, setTab] = useState('live');

  const enabled = data?.enabled ?? false;
  const maxVus = data?.maxVus ?? 300;
  const load = data?.load ?? null;
  const running = load?.state === 'RUNNING';
  const preparing = data?.accounts?.state === 'RUNNING';
  const series = data?.series ?? {};

  // 실행이 끝나면 결과 탭으로, 새로 시작하면 실시간 탭으로
  const runKey = `${load?.id}-${running}`;
  useEffect(() => {
    if (load) setTab(running ? 'live' : 'result');
  }, [runKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onStart = () => start.mutate({ scenario, vus: Math.max(1, vus), durationSec }, {
    onSuccess: () => toast(`부하테스트를 시작했어요: 동시 사용자 ${Math.max(1, vus)}명`),
    onError: (err) => toast(errorMessage(err, '부하테스트를 시작하지 못했어요.')),
  });
  // 슬라이더를 놓을 때 한 번만 보낸다(끄는 중에는 화면 값만 바뀜)
  const onRelease = () => running && scale.mutate({ vus }, {
    onError: (err) => toast(errorMessage(err, '사용자 수를 바꾸지 못했어요.')),
  });
  const onStop = () => stop.mutate(undefined, {
    onSuccess: () => toast('부하테스트를 중지했어요.'),
    onError: (err) => toast(errorMessage(err, '중지하지 못했어요.')),
  });
  const onAccounts = () => accounts.mutate(undefined, {
    onSuccess: () => toast('부하용 계정 300개를 준비하고 있어요(약 1분).'),
    onError: (err) => toast(errorMessage(err, '계정 준비를 시작하지 못했어요.')),
  });

  return (
    <section aria-label="부하테스트" className="panel">
      <div className="panel-head">
        <div className="flex items-center gap-3">
          <h2 className="panel-title">부하테스트</h2>
          {load && (
            <span className={`px-2 py-0.5 text-sm font-bold ${running ? 'bg-rust-soft text-rust' : 'bg-sand text-ink-2'}`}>{STATE_LABEL[load.state] ?? load.state}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-mute">
            {data?.accounts ? `계정 준비 ${STATE_LABEL[data.accounts.state] ?? data.accounts.state}` : '장바구니 시나리오는 계정 준비 먼저'}
          </span>
          <button type="button" className="btn btn-line" disabled={!enabled || running || preparing || accounts.isPending} onClick={onAccounts}>
            계정 준비
          </button>
        </div>
      </div>

      <div className="px-5 py-4 grid gap-4">
        {!enabled && data && <p className="text-sm text-mute">부하테스트 기능이 꺼져 있어요. (APP_LOADTEST_ENABLED)</p>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-base">
            <span className="text-mute">시나리오</span>
            <select className="field w-auto" value={scenario} disabled={running} onChange={(e) => onScenarioChange(e.target.value)}>
              {SCENARIOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <span className="flex flex-wrap items-center gap-1 text-sm" aria-label="시나리오가 쓰는 서비스">
            <span className="text-mute">사용 서비스</span>
            {(SCENARIO_SERVICES[running ? load.scenario : scenario] ?? []).map((s) => (
              <span key={s} className="px-1.5 py-0.5 border border-ink font-bold">{serviceShortName(s)}</span>
            ))}
          </span>
          <label className="flex items-center gap-2 text-base">
            <span className="text-mute">최대 시간</span>
            <select className="field w-auto" value={durationSec} disabled={running} onChange={(e) => setDurationSec(Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d / 60}분</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 text-base grow min-w-[260px]">
            <span className="text-mute shrink-0">동시 사용자</span>
            <input
              type="range" min={0} max={maxVus} step={10} value={vus} className="grow accent-rust" aria-label="동시 사용자 수"
              onChange={(e) => setVus(Number(e.target.value))} onPointerUp={onRelease} onKeyUp={onRelease}
            />
            <b className="w-16 text-right tabular-nums text-lg">{vus}명</b>
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ink" disabled={!enabled || running || preparing || start.isPending} onClick={onStart}>부하 시작</button>
            <button type="button" className={`btn ${running ? 'btn-point' : 'btn-line'}`} disabled={!running || stop.isPending} onClick={onStop}>부하 중지</button>
          </div>
        </div>
        {running && <p className="text-sm text-mute -mt-2">실행 중에는 슬라이더를 놓는 순간 사용자 수가 바뀌어요. 0명이면 요청을 멈추고 대기해요.</p>}

        {load && <ProgressBar load={load} running={running} />}

        <div>
          <div className="flex gap-1 border-b border-line mb-3" role="tablist" aria-label="부하테스트 보기">
            {[['live', '실시간'], ['result', '결과']].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key}
                className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-ink font-bold' : 'border-transparent text-mute'}`}
                onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
          {tab === 'live' ? <LiveTab series={series} result={data?.result} /> : <ResultTab result={data?.result} running={running} />}
        </div>
      </div>
    </section>
  );
}
