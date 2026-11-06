import { useState } from 'react';
import SystemKillDialog from '@/features/admin/components/SystemKillDialog';
import { formatErrorRate, serviceShortName } from '@/features/admin/constants';

// 서비스 상태 패널 — 담당 박지연. 강의실 전자칠판에서 멀리서도 보이게 카드 전체를 상태 색으로 칠하고, 색만으로 구분하지 않도록 글자를 같이 쓴다(설계 3절)
const STATE = {
  UP: { label: '정상', card: 'border-line bg-paper', pill: 'bg-moss-soft text-moss' },
  DEGRADED: { label: '일부', card: 'border-amber bg-amber-soft', pill: 'bg-amber text-white' },
  DOWN: { label: '중단', card: 'border-rust bg-rust-soft', pill: 'bg-rust text-white' },
  RECOVERING: { label: '복구 중', card: 'border-sky bg-sky-soft', pill: 'bg-sky text-white' },
};
const stateOf = (service) => STATE[service.state] ?? { label: service.state, card: 'border-line bg-paper', pill: 'bg-sand text-ink-2' };

function PodDots({ ready, desired }) {
  return (
    <span role="img" aria-label={`파드 ${desired}개 중 ${ready}개 준비`} className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-xl leading-none tracking-wider">
        {'●'.repeat(ready)}<span className="text-mute">{'○'.repeat(desired - ready)}</span>
      </span>
      <span className="text-lg tabular-nums text-ink-2">{ready}/{desired}</span>
    </span>
  );
}

function ServiceCard({ service, errorRate, chaosEnabled, onKill }) {
  const state = stateOf(service);
  const name = serviceShortName(service.name);
  return (
    <li className={`border-2 p-3 ${state.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl font-bold">{name}</span>
        <span className={`px-2 py-0.5 text-lg font-bold whitespace-nowrap ${state.pill}`}>{state.label}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 mt-2">
        <PodDots ready={service.ready} desired={service.desired} />
        <span className="text-lg tabular-nums whitespace-nowrap">오류 {formatErrorRate(errorRate)}</span>
      </div>
      <button type="button" className="btn btn-line btn-sm w-full mt-2" disabled={!chaosEnabled || service.state !== 'UP'} onClick={() => onKill(service)}
        aria-label={`${name} 내리기`}>내리기</button>
    </li>
  );
}

// 입구 · 관리자 · 로그인 — 시연에서 내리지 않으니 한 줄로 줄인다
function FixedService({ service, errorRate }) {
  const state = stateOf(service);
  return (
    <li className="inline-flex items-center gap-2">
      <span className="text-lg font-bold">{serviceShortName(service.name)}</span>
      <PodDots ready={service.ready} desired={service.desired} />
      <span className={`px-2 text-base font-bold whitespace-nowrap ${state.pill}`}>{state.label}</span>
      <span className="text-base tabular-nums whitespace-nowrap">오류 {formatErrorRate(errorRate)}</span>
    </li>
  );
}

// 복구 중에는 내리기를 막는다
export default function SystemServicePanel({ services, metrics, chaosEnabled = false }) {
  const [killTarget, setKillTarget] = useState(null);
  const errorRateOf = Object.fromEntries((metrics?.services ?? []).map((m) => [m.name, m.errorRate]));
  const killable = services.filter((s) => s.killable);
  const fixed = services.filter((s) => !s.killable);
  return (
    <section aria-label="서비스 상태" className="border border-line bg-paper p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
        <h2 className="text-lg font-bold">서비스 상태</h2>
        {!chaosEnabled && <p className="text-sm text-mute">내리기 기능이 꺼져 있어요. 시연 때만 켭니다.</p>}
      </div>
      <ul aria-label="내릴 수 있는 서비스" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {killable.map((s) => <ServiceCard key={s.name} service={s} errorRate={errorRateOf[s.name]} chaosEnabled={chaosEnabled} onKill={setKillTarget} />)}
      </ul>
      {fixed.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3">
          <span className="text-sm text-mute whitespace-nowrap">내릴 수 없음</span>
          <ul aria-label="내릴 수 없는 서비스" className="contents">
            {fixed.map((s) => <FixedService key={s.name} service={s} errorRate={errorRateOf[s.name]} />)}
          </ul>
        </div>
      )}
      {killTarget && <SystemKillDialog service={killTarget} onClose={() => setKillTarget(null)} />}
    </section>
  );
}
