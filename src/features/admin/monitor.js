// 시스템 상태 — 부하테스트 시나리오 · 실시간 모니터링 공통 규칙. 담당 구지훈(11/16)

// 시나리오가 실제로 부르는 서비스(gotgan-config files/loadtest/demo.js 요청 기준) — 아래 서비스 상태 카드 이름과 같다
export const SCENARIO_SERVICES = {
  BROWSE: ['product-service', 'review-service', 'store-service'],
  REVIEWS: ['review-service'],
  CART: ['user-service', 'order-service', 'product-service', 'store-service'],
  MIXED: ['product-service', 'review-service', 'store-service', 'user-service', 'order-service'],
};

// 이상 판단 — 5xx 건수가 최근 3개 점(약 15초) 중 하나라도 0 보다 크면. 정상이면 0건이 맞다
export const hasErrors = (points = []) => points.slice(-3).some((p) => p.v > 0);

// 응답 시간 급등 — 마지막 값이 1초를 넘거나, 그 전 값들의 중앙값의 3배 + 200ms 를 넘으면
export function isLatencySpike(points = []) {
  if (points.length === 0) return false;
  const last = points.at(-1).v;
  if (last > 1000) return true;
  const before = points.slice(0, -1).map((p) => p.v).filter((v) => v > 0).sort((a, b) => a - b);
  if (before.length < 3) return false;
  const median = before[Math.floor(before.length / 2)];
  return last > median * 3 + 200;
}

// 목록 시각 — HH:mm:ss.SSS (요청이 1초에 여러 건이라 밀리초까지)
export const formatClock = (ms) => {
  const d = new Date(ms);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

export const isServerError = (status) => status != null && status >= 500;
