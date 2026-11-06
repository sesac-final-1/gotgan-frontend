import { formatErrorRate } from '@/features/admin/constants';

// 서비스 상태 패널 — 담당 박지연. 발표 화면에서 뒤에서도 보이게 글자 · 점을 크게, 색만으로 구분하지 않고 글자를 같이 쓴다(설계 3절)
const STATE = {
  UP: { label: '정상', className: 'bg-moss-soft text-moss' },
  DEGRADED: { label: '일부', className: 'bg-amber-soft text-amber' },
  DOWN: { label: '중단', className: 'bg-rust-soft text-rust' },
  RECOVERING: { label: '복구 중', className: 'bg-sky-soft text-sky' },
};

const shortName = (name) => name.replace(/-service$/, '');

function PodDots({ ready, desired }) {
  return (
    <span role="img" aria-label={`파드 ${desired}개 중 ${ready}개 준비`} className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-xl leading-none tracking-wider">
        {'●'.repeat(ready)}<span className="text-line-2">{'○'.repeat(desired - ready)}</span>
      </span>
      <span className="text-base tabular-nums text-ink-2">{ready}/{desired}</span>
    </span>
  );
}

function ServiceRow({ service, errorRate }) {
  const state = STATE[service.state] ?? { label: service.state, className: 'bg-sand text-ink-2' };
  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[minmax(7rem,1fr)_6rem_6rem_6rem] items-center gap-3 py-3 border-t border-line first:border-t-0">
      <span className="text-lg font-bold">{shortName(service.name)}</span>
      <PodDots ready={service.ready} desired={service.desired} />
      <span className={`inline-flex justify-center px-2 py-1 text-base font-bold whitespace-nowrap ${state.className}`}>{state.label}</span>
      <span className="text-right text-base tabular-nums whitespace-nowrap">오류 {formatErrorRate(errorRate)}</span>
    </li>
  );
}

// 내릴 수 있는 서비스를 위에, 입구 · 관리자 · 로그인은 아래에 묶는다
export default function SystemServicePanel({ services, metrics }) {
  const errorRateOf = Object.fromEntries((metrics?.services ?? []).map((m) => [m.name, m.errorRate]));
  const sorted = [...services].sort((a, b) => Number(b.killable) - Number(a.killable));
  return (
    <section aria-label="서비스 상태" className="border border-line bg-paper p-4">
      <h2 className="text-base font-bold mb-1">서비스 상태</h2>
      <ul>
        {sorted.map((s) => <ServiceRow key={s.name} service={s} errorRate={errorRateOf[s.name]} />)}
      </ul>
    </section>
  );
}
