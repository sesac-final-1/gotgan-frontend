import { useState } from 'react';
import SystemKillDialog from '@/features/admin/components/SystemKillDialog';
import { formatErrorRate, serviceShortName } from '@/features/admin/constants';

// 서비스 상태 패널 — 담당 박지연. 발표 화면에서 뒤에서도 보이게 글자 · 점을 크게, 색만으로 구분하지 않고 글자를 같이 쓴다(설계 3절)
const STATE = {
  UP: { label: '정상', className: 'bg-moss-soft text-moss' },
  DEGRADED: { label: '일부', className: 'bg-amber-soft text-amber' },
  DOWN: { label: '중단', className: 'bg-rust-soft text-rust' },
  RECOVERING: { label: '복구 중', className: 'bg-sky-soft text-sky' },
};

function PodDots({ ready, desired }) {
  return (
    <span role="img" aria-label={`파드 ${desired}개 중 ${ready}개 준비`} className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-xl leading-none tracking-wider">
        {'●'.repeat(ready)}<span className="text-mute">{'○'.repeat(desired - ready)}</span>
      </span>
      <span className="text-base tabular-nums text-ink-2">{ready}/{desired}</span>
    </span>
  );
}

function ServiceRow({ service, errorRate, chaosEnabled, onKill }) {
  const state = STATE[service.state] ?? { label: service.state, className: 'bg-sand text-ink-2' };
  return (
    <li className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[minmax(7rem,1fr)_6.5rem_6rem_6rem_6rem] items-center gap-3 py-3 border-t border-line first:border-t-0">
      <span className="text-xl font-bold">{serviceShortName(service.name)}</span>
      <PodDots ready={service.ready} desired={service.desired} />
      <span className={`inline-flex justify-center px-2 py-1 text-lg font-bold whitespace-nowrap ${state.className}`}>{state.label}</span>
      <span className="col-span-2 sm:col-span-1 sm:text-right text-lg tabular-nums whitespace-nowrap">오류 {formatErrorRate(errorRate)}</span>
      {service.killable ? (
        <button type="button" className="btn btn-line btn-sm" disabled={!chaosEnabled || service.state !== 'UP'} onClick={() => onKill(service)}
          aria-label={`${serviceShortName(service.name)} 내리기`}>내리기</button>
      ) : (
        <span className="text-right text-sm text-mute whitespace-nowrap">내릴 수 없음</span>
      )}
    </li>
  );
}

// 내릴 수 있는 서비스를 위에, 입구 · 관리자 · 로그인은 아래에 묶는다. 복구 중에는 내리기를 막는다
export default function SystemServicePanel({ services, metrics, chaosEnabled = false }) {
  const [killTarget, setKillTarget] = useState(null);
  const errorRateOf = Object.fromEntries((metrics?.services ?? []).map((m) => [m.name, m.errorRate]));
  const sorted = [...services].sort((a, b) => Number(b.killable) - Number(a.killable));
  return (
    <section aria-label="서비스 상태" className="border border-line bg-paper p-4">
      <h2 className="text-lg font-bold mb-1">서비스 상태</h2>
      {!chaosEnabled && <p className="text-sm text-mute">내리기 기능이 꺼져 있어요. 시연 때만 켭니다.</p>}
      <ul>
        {sorted.map((s) => <ServiceRow key={s.name} service={s} errorRate={errorRateOf[s.name]} chaosEnabled={chaosEnabled} onKill={setKillTarget} />)}
      </ul>
      {killTarget && <SystemKillDialog service={killTarget} onClose={() => setKillTarget(null)} />}
    </section>
  );
}
