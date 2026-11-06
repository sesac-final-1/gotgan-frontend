import { serviceShortName } from '@/features/admin/constants';

// 사용자 기능 패널 — 담당 박지연. 서버가 의존 관계로 계산한 값(features)을 그대로 보여 준다. 실제 쇼핑몰 확인이 아니라서 그 사실을 화면에 적는다(설계 4절)
const STATE = {
  UP: { icon: '🟢', label: '정상', className: 'text-moss' },
  DEGRADED: { icon: '🟡', label: '일부', className: 'text-amber' },
  DOWN: { icon: '🔴', label: '중단', className: 'text-rust' },
};

function FeatureRow({ feature }) {
  const state = STATE[feature.state] ?? { icon: '⚪', label: feature.state, className: 'text-ink-2' };
  return (
    <li className="flex flex-wrap items-center gap-x-2 py-3 border-t border-line first:border-t-0">
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
      <h2 className="text-lg font-bold mb-1">사용자 기능</h2>
      <ul>
        {features.map((f) => <FeatureRow key={f.key} feature={f} />)}
      </ul>
      <p className="mt-2 text-sm text-mute">의존 관계로 계산한 값이에요.</p>
    </section>
  );
}
