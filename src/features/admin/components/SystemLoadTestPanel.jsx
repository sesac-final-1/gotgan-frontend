import { useState } from 'react';
import { toast } from '@/shared/stores/toastStore';
import LoadTestChart from '@/features/admin/components/LoadTestChart';
import {
  useLoadTestQuery, usePrepareAccountsMutation, useScaleLoadTestMutation, useStartLoadTestMutation, useStopLoadTestMutation,
} from '@/features/admin/hooks/useSystemQueries';

// 부하테스트 패널(11/16, 발표 시연) — 담당 구지훈. 시나리오를 고르고 시작하면 클러스터 안 k6 가 부하를 보내고,
// 실행 중에는 슬라이더를 놓을 때마다 사용자 수를 바꾼다. 계약 backend admin.md 8절
const SCENARIOS = [
  { value: 'BROWSE', label: '둘러보기 (조회)' },
  { value: 'REVIEWS', label: '리뷰 조회 폭주' },
  { value: 'CART', label: '장바구니 CRUD (계정 필요)' },
  { value: 'MIXED', label: '혼합 (둘러보기 70%, 장바구니 30%)' },
];
const DURATIONS = [60, 180, 300, 600];
const STATE_LABEL = { RUNNING: '실행 중', DONE: '완료', FAILED: '실패' };

const errorMessage = (err, fallback) => err.response?.data?.message ?? fallback;
const elapsed = (startedAt) => {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

export default function SystemLoadTestPanel() {
  const { data } = useLoadTestQuery();
  const start = useStartLoadTestMutation();
  const scale = useScaleLoadTestMutation();
  const stop = useStopLoadTestMutation();
  const accounts = usePrepareAccountsMutation();
  const [scenario, setScenario] = useState('BROWSE');
  const [durationSec, setDurationSec] = useState(300);
  const [vus, setVus] = useState(50);

  const enabled = data?.enabled ?? false;
  const maxVus = data?.maxVus ?? 300;
  const load = data?.load ?? null;
  const running = load?.state === 'RUNNING';
  const preparing = data?.accounts?.state === 'RUNNING';
  const series = data?.series ?? {};

  const onStart = () => start.mutate({ scenario, vus: Math.max(1, vus), durationSec }, {
    onSuccess: () => toast(`부하테스트를 시작했어요 — 동시 사용자 ${Math.max(1, vus)}명`),
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
    onSuccess: () => toast('부하용 계정 300개를 준비하고 있어요 — 약 1분'),
    onError: (err) => toast(errorMessage(err, '계정 준비를 시작하지 못했어요.')),
  });

  return (
    <section aria-label="부하테스트" className="panel">
      <div className="panel-head">
        <div className="flex items-center gap-3">
          <h2 className="panel-title">부하테스트</h2>
          {load && (
            <span className={`px-2 py-0.5 text-sm font-bold ${running ? 'bg-rust-soft text-rust' : 'bg-sand text-ink-2'}`}>
              {STATE_LABEL[load.state] ?? load.state}{running && ` ${elapsed(load.startedAt)}`}
            </span>
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
            <select className="field w-auto" value={scenario} disabled={running} onChange={(e) => setScenario(e.target.value)}>
              {SCENARIOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
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
          {running ? (
            <button type="button" className="btn btn-line" disabled={stop.isPending} onClick={onStop}>중지</button>
          ) : (
            <button type="button" className="btn btn-ink" disabled={!enabled || preparing || start.isPending} onClick={onStart}>부하 시작</button>
          )}
        </div>
        {running && <p className="text-sm text-mute -mt-2">실행 중에는 슬라이더를 놓는 순간 사용자 수가 바뀌어요. 0명이면 요청을 멈추고 대기해요.</p>}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <LoadTestChart label="동시 사용자" points={series.vus} floor={10} format={(v) => `${Math.round(v)}명`} tone="text-rust" />
          <LoadTestChart label="초당 요청" points={series.rps} floor={10} format={(v) => `${v.toFixed(0)}건`} />
          <LoadTestChart label="응답 시간 p95" points={series.p95Ms} floor={100} format={(v) => `${v.toFixed(0)}ms`} />
          <LoadTestChart label="에러율" points={series.errorRate} floor={0.05} format={(v) => `${(v * 100).toFixed(1)}%`} tone="text-rust" />
        </div>
      </div>
    </section>
  );
}
