import { serviceShortName } from '@/features/admin/constants';

// 사용자 기능 패널 — 담당 박지연. 서버가 의존 관계로 계산한 값(features)을 그대로 보여 준다. 실제 쇼핑몰 확인이 아니라서 그 사실을 화면에 적는다(설계 4절)
const STATE = {
  UP: { icon: '🟢', label: '정상', className: 'text-moss', legend: '정상' },
  DEGRADED: { icon: '🟡', label: '일부', className: 'text-amber', legend: '일부 동작' },
  DOWN: { icon: '🔴', label: '중단', className: 'text-rust', legend: '중단' },
};

// 색이 무슨 뜻인지 — 발표를 보는 사람도 바로 읽게 패널 위에 둔다
function Legend() {
  return (
    <ul aria-label="상태 설명" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
      {Object.values(STATE).map((s) => (
        <li key={s.label}><span aria-hidden="true">{s.icon}</span> <b className={s.className}>{s.legend}</b></li>
      ))}
    </ul>
  );
}

function FeatureRow({ feature }) {
  const state = STATE[feature.state] ?? { icon: '⚪', label: feature.state, className: 'text-ink-2' };
  return (
    <li className="flex flex-wrap items-center gap-x-2 py-2 border-t border-line">
      <span aria-hidden="true" className="text-base leading-none">{state.icon}</span>
      <span className="text-xl font-bold">{feature.label}</span>
      <span className={`ml-auto text-lg font-bold ${state.className}`}>
        {state.label}
        {feature.causes?.length > 0 && <span className="font-normal"> · {feature.causes.map(serviceShortName).join(', ')}</span>}
      </span>
    </li>
  );
}

export default function SystemFeaturePanel({ features }) {
  return (
    <section aria-label="사용자 기능" className="border border-line bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
        <h2 className="text-lg font-bold">사용자 기능</h2>
        <Legend />
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-6">
        {features.map((f) => <FeatureRow key={f.key} feature={f} />)}
      </ul>
      <p className="mt-1 text-sm text-mute">의존 관계로 계산한 값이에요.</p>
    </section>
  );
}
