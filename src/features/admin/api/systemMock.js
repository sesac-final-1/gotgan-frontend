// 장애 시연 화면 목 데이터 — 담당 박지연. 계약(11/10 지훈 초안)이 나와 systemApi.js 를 실제 API 로 바꾸면 이 파일은 삭제한다
// 값 근거: 복구 시간 · 기능 영향은 QA 2차 5-1 장애 영향표. user · settlement 복구 시간은 미측정이라 가정값

const SERVICES = [
  { name: 'order-service', desired: 2, killable: true, recoverSeconds: 23 },
  { name: 'product-service', desired: 2, killable: true, recoverSeconds: 23 },
  { name: 'payment-service', desired: 2, killable: true, recoverSeconds: 20 },
  { name: 'store-service', desired: 2, killable: true, recoverSeconds: 27 },
  { name: 'user-service', desired: 2, killable: true, recoverSeconds: 25 },
  { name: 'review-service', desired: 1, killable: true, recoverSeconds: 27 },
  { name: 'settlement-service', desired: 1, killable: true, recoverSeconds: 25 },
  { name: 'chat-service', desired: 1, killable: true, recoverSeconds: 19 },
  { name: 'gateway-service', desired: 2, killable: false },
  { name: 'admin-service', desired: 1, killable: false },
  { name: 'keycloak', desired: 1, killable: false },
];

// 장애 영향표 기준 — 장바구니는 상품 · 스토어를 조회해서 order 외에도 멈춘다. payment 는 결제만 막고 장바구니는 살아 있다
const FEATURES = [
  { key: 'BROWSE', label: '둘러보기 · 상품 상세', needs: ['product-service'] },
  { key: 'REVIEW', label: '리뷰 보기', needs: ['review-service'] },
  { key: 'CART', label: '장바구니', needs: ['order-service', 'product-service', 'store-service'] },
  { key: 'ORDER', label: '주문 · 결제', needs: ['order-service', 'payment-service', 'product-service', 'store-service'] },
  { key: 'CHAT', label: '채팅', needs: ['chat-service'] },
  { key: 'MEMBER', label: '회원 · 마이페이지', needs: ['user-service'] },
  { key: 'SETTLEMENT', label: '정산', needs: ['settlement-service'] },
];

const DOWN_SECONDS = 8; // 전부 내린 직후 '중단' 으로 보이는 시간 — 그 뒤 새 파드 기동('복구 중')
const COOLDOWN_SECONDS = 60; // 서비스당 재시도 제한(설계 4절)

let events = [];
let nextEventId = 1;

/** 테스트에서 처음 상태로 되돌린다 */
export const resetSystemMock = () => {
  events = [];
  nextEventId = 1;
};

const NODES = ['ip-10-0-11-126', 'ip-10-0-12-167'];

const rejected = (status, code, message) => Object.assign(new Error(message), { response: { status, data: { code, message, data: null } } });

/** 서비스별 가장 최근 내리기 기록 — 복구가 끝났으면 없음 */
function activeEvent(name, now) {
  const e = events.find((x) => x.service === name);
  return e && now < e.recoverAt ? e : null;
}

function serviceState(svc, now) {
  const e = activeEvent(svc.name, now);
  if (!e) return { state: 'UP', ready: svc.desired };
  if (e.scope === 'ONE' && svc.desired > 1) return { state: 'DEGRADED', ready: svc.desired - 1 };
  return { state: now - e.killedAt < DOWN_SECONDS * 1000 ? 'DOWN' : 'RECOVERING', ready: 0 };
}

function podsOf(svc, ready, now, event) {
  return Array.from({ length: svc.desired }, (_, i) => ({
    name: `${svc.name}-${i + 1}`,
    node: NODES[i % NODES.length],
    phase: i < ready ? 'Running' : 'Pending',
    ready: i < ready,
    restarts: 0,
    ageSeconds: i < ready || !event ? 3600 : Math.floor((now - event.killedAt) / 1000),
    terminating: false,
  }));
}

export function mockStatus() {
  const now = Date.now();
  const services = SERVICES.map((svc) => {
    const { state, ready } = serviceState(svc, now);
    return { name: svc.name, killable: svc.killable, desired: svc.desired, ready, state, pods: podsOf(svc, ready, now, activeEvent(svc.name, now)) };
  });
  const byName = Object.fromEntries(services.map((s) => [s.name, s]));
  const features = FEATURES.map(({ key, label, needs }) => {
    const causes = needs.filter((n) => byName[n].ready === 0);
    return { key, label, state: causes.length ? 'DOWN' : 'UP', causes };
  });
  return { chaosEnabled: true, serverTime: new Date(now).toISOString(), services, features };
}

export function mockMetrics() {
  const now = Date.now();
  return {
    services: SERVICES.map((svc) => {
      const { ready } = serviceState(svc, now);
      return { name: svc.name, requestsPerSecond: ready ? 12.5 : 0, errorRate: ready ? 0 : 1 };
    }),
  };
}

export function mockKill(name, { scope }) {
  const now = Date.now();
  const svc = SERVICES.find((s) => s.name === name);
  if (!svc?.killable) throw rejected(400, 'SYSTEM_SERVICE_NOT_KILLABLE', '내릴 수 없는 서비스입니다.');
  const last = events.find((x) => x.service === name);
  if (last && now - last.killedAt < COOLDOWN_SECONDS * 1000) throw rejected(409, 'SYSTEM_KILL_COOLDOWN', '복구 중이거나 방금 내린 서비스입니다. 잠시 후 다시 시도해 주세요.');
  const event = {
    eventId: String(nextEventId++),
    service: name,
    scope: svc.desired > 1 ? scope : 'ALL',
    actorId: 1,
    killedAt: now,
    recoverAt: now + (scope === 'ONE' && svc.desired > 1 ? 15 : svc.recoverSeconds) * 1000,
  };
  events = [event, ...events];
  const count = event.scope === 'ONE' ? 1 : svc.desired;
  return { eventId: event.eventId, deletedPods: Array.from({ length: count }, (_, i) => `${name}-${i + 1}`) };
}

export function mockEvents() {
  const now = Date.now();
  return events.slice(0, 20).map(({ eventId, service, scope, actorId, killedAt, recoverAt }) => {
    const recovered = now >= recoverAt;
    return {
      eventId,
      service,
      scope,
      actorId,
      killedAt: new Date(killedAt).toISOString(),
      recoveredAt: recovered ? new Date(recoverAt).toISOString() : null,
      recoverySeconds: recovered ? Math.round((recoverAt - killedAt) / 1000) : null,
    };
  });
}
