// 부하테스트 그래프 한 칸 — 선 그래프(SVG, 라이브러리 없음). 담당 구지훈(11/16)
// 점은 서버가 1초 간격으로 준다([{ t: epoch ms, v }]). 가로축은 첫 점부터 채우고 창 길이는 1 ~ 5분(시작 직후에도 오른쪽 끝에 몰리지 않게).
// y 축은 0 부터, 최댓값은 floor 이상으로 잡아 작은 값이 과장돼 보이지 않게
const MIN_WINDOW_MS = 60 * 1000;
const MAX_WINDOW_MS = 5 * 60 * 1000;
const W = 300;
const H = 80;

export default function LoadTestChart({ label, points = [], format, floor = 1, tone = 'text-ink' }) {
  const last = points.at(-1);
  const first = points[0]?.t ?? 0;
  const end = last?.t ?? 0;
  const span = Math.min(MAX_WINDOW_MS, Math.max(MIN_WINDOW_MS, end - first));
  const begin = Math.max(first, end - span);
  const max = Math.max(floor, ...points.map((p) => p.v)) * 1.15;
  const xy = points.map((p) => [((p.t - begin) / span) * W, H - (p.v / max) * H]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <figure className="border border-line bg-paper px-3 pt-2 pb-1 min-w-0" aria-label={label}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-mute">{label}</span>
        <b className="text-xl tabular-nums">{last ? format(last.v) : '-'}</b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`w-full h-20 ${tone}`} role="img" aria-hidden="true">
        {xy.length > 1 && (
          <>
            <polygon points={`${xy[0][0]},${H} ${line} ${xy.at(-1)[0]},${H}`} fill="currentColor" opacity="0.08" />
            <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </figure>
  );
}
