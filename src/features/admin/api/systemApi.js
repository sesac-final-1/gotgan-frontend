// 장애 시연 화면 API — 담당 박지연(화면) · 구지훈(API). 계약: backend docs/api/admin.md 7절. 응답은 화면에서 그대로 쓴다
import { axiosInstance } from '@/shared/api/axiosInstance';

const BASE = '/api/admin/system';

// 2초 폴링. 쿠버네티스 조회 실패면 503 → 화면은 마지막 값 유지 + 연결 끊김
export const fetchSystemStatus = async () => (await axiosInstance.get(`${BASE}/status`)).data.data;

// 15초 폴링. Prometheus 실패 · 요청 0 은 200 에 null → 화면은 '-'
export const fetchSystemMetrics = async () => (await axiosInstance.get(`${BASE}/metrics`)).data.data;

// 타임라인 — 최신순 최근 20건
export const fetchSystemEvents = async () => (await axiosInstance.get(`${BASE}/events`)).data.data;

// 202 { eventId, deletedPods } — scope: 'ONE' | 'ALL'. 스위치가 꺼져 있으면 403
export const killService = async ({ name, scope, reason }) =>
  (await axiosInstance.post(`${BASE}/services/${encodeURIComponent(name)}/kill`, { scope, reason })).data.data;

// 시나리오 — 레플리카 2 이상 서비스의 파드를 1개씩 한 번에 내린다(admin.md 7-2-1). 대상 중 하나라도 정상이 아니면 아무것도 지우지 않고 409
// 202 { services: [{ service, eventId, deletedPods }] }. 사유를 비우면 서버가 「시나리오 — …」 로 기록
export const killOneEach = async ({ reason } = {}) =>
  (await axiosInstance.post(`${BASE}/scenarios/kill-one-each`, reason ? { reason } : {})).data.data;
