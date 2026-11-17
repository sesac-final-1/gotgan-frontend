// 부하테스트 진행 상태와 결과 해석 — 담당 구지훈(11/17 피드백, 계약 backend admin.md 8절)

export const SCENARIO_LABEL = { BROWSE: '둘러보기', REVIEWS: '리뷰 조회 폭주', CART: '장바구니 CRUD', MIXED: '혼합' };

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/** 진행 상태 — 경과, 남은 시간, 진행률(0~100). 끝난 실행은 실제 끝난 시각 기준 */
export function progress(load, nowMs = Date.now()) {
  if (!load) return null;
  const start = new Date(load.startedAt).getTime();
  const end = load.finishedAt ? new Date(load.finishedAt).getTime() : nowMs;
  const total = load.durationSec * 1000;
  const elapsed = Math.max(0, Math.min(end - start, total));
  return {
    elapsed: mmss(Math.floor(elapsed / 1000)),
    remaining: mmss(Math.max(0, Math.ceil((total - elapsed) / 1000))),
    percent: Math.round((elapsed / total) * 100),
  };
}

// 상태 코드 → 원인 설명(운영자가 읽는 말)
const STATUS_CAUSE = {
  '연결 실패': '서버에 닿지 못함(연결 거부, 시간 초과)',
  429: '요청 제한에 걸림(같은 사용자, IP 가 너무 자주 요청)',
  401: '로그인 토큰 문제(만료, 미발급)',
  403: '권한 없음',
  404: '없는 자원 요청',
  409: '상태 충돌(재고, 중복 요청)',
  500: '서버 내부 오류',
  502: '서비스 연결 실패(파드 종료, 재시작)',
  503: '서비스 일시 중단(차단기 열림 등)',
  504: '응답 시간 초과',
};

/** 결과의 원인 개조식 — 실패가 없으면 한 줄, 있으면 상태 코드별 원인 + 서버 쪽 5xx 서비스 */
export function failureCauses(result) {
  if (!result || result.failed === 0) return ['실패 없음: 모든 요청이 정상 응답(2xx)'];
  const lines = Object.entries(result.byStatus)
    .filter(([status]) => !status.startsWith('2'))
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => `${status} ${n.toLocaleString('ko-KR')}건: ${STATUS_CAUSE[status] ?? '기타 오류'}`);
  const servers = Object.entries(result.serverErrors ?? {});
  if (servers.length) {
    lines.push(`같은 시간 서버 5xx: ${servers.map(([s, n]) => `${s.replace(/-service$/, '')} ${n}건`).join(', ')}`);
  }
  return lines;
}

export const formatCount = (n) => (n == null ? '-' : Number(n).toLocaleString('ko-KR'));
