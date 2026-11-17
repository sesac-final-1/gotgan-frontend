// 장애 시연 화면 API — 담당 박지연(화면), 구지훈(API). 계약: backend docs/api/admin.md 7절. 응답은 화면에서 그대로 쓴다
import { axiosInstance } from '@/shared/api/axiosInstance';

const BASE = '/api/admin/system';

// 2초 폴링. 쿠버네티스 조회 실패면 503 → 화면은 마지막 값 유지 + 연결 끊김
export const fetchSystemStatus = async () => (await axiosInstance.get(`${BASE}/status`)).data.data;

// 15초 폴링. Prometheus 실패, 요청 0 은 200 에 null → 화면은 '-'
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

// ── 부하테스트(11/16, admin.md 8절) — k6 Job 을 클러스터 안에서 실행. 실행 중 2초 폴링
const LOADTEST = `${BASE}/loadtest`;

// { enabled, maxVus, load, accounts, series: { vus, rps, p95Ms, errorRate: [{ t, v }] } }
export const fetchLoadTest = async () => (await axiosInstance.get(LOADTEST)).data.data;

// 202 { id } — scenario: BROWSE, REVIEWS, CART, MIXED. 실행 중이면 409 SYSTEM_LOADTEST_RUNNING
export const startLoadTest = async ({ scenario, vus, durationSec }) =>
  (await axiosInstance.post(LOADTEST, { scenario, vus, durationSec })).data.data;

// 실행 중 사용자 수 변경(0 ~ maxVus) — 없거나 준비 중이면 409 SYSTEM_LOADTEST_NOT_RUNNING
export const scaleLoadTest = async ({ vus }) => (await axiosInstance.patch(LOADTEST, { vus })).data.data;

export const stopLoadTest = async () => (await axiosInstance.delete(LOADTEST)).data.data;

// 부하용 계정 300개 가입(약 1분) — 장바구니, 혼합 시나리오 전에 하루 한 번
export const prepareLoadTestAccounts = async () => (await axiosInstance.post(`${LOADTEST}/accounts`)).data.data;

// ── 실시간 모니터링(11/16, admin.md 9절) — 실제 트래픽 기준. 실패해도 200 에 빈 값
const MONITOR = `${BASE}/monitor`;

// { serverTime, total: { rps, avgMs, errors }, services: [{ name, series, db }] } — 점 [{ t, v }], errors = 최근 1분 5xx 건수
export const fetchMonitorOverview = async () => (await axiosInstance.get(`${MONITOR}/overview`)).data.data;

// [{ traceId, timestampMs, method, path, service, status, durationMs }] 최신순. 액추에이터는 서버가 뺀다, service 가 있으면 그 서비스만
export const fetchMonitorCalls = async (service) =>
  (await axiosInstance.get(`${MONITOR}/calls`, service ? { params: { service } } : undefined)).data.data;

// [{ kind: RESPONSE | LOG, timestampMs, service, level, title, status, traceId }] 최신순. service 가 있으면 그 서비스만
export const fetchMonitorErrors = async (service) =>
  (await axiosInstance.get(`${MONITOR}/errors`, service ? { params: { service } } : undefined)).data.data;

// { traceId, durationMs, spans: [{ id, parentId, service, name, kind, startMs, durationMs, status, error }] }
export const fetchMonitorTrace = async (traceId) => (await axiosInstance.get(`${MONITOR}/traces/${encodeURIComponent(traceId)}`)).data.data;

// { topErrors, slowest, statuses } 최근 5분
export const fetchMonitorSummary = async () => (await axiosInstance.get(`${MONITOR}/summary`)).data.data;

// ── 장애 분석 리포트(11/17, admin.md 10절) — from, to 는 epoch ms, 서버에는 ISO 로. 최근 7일 안
// { summary, buckets, issues, events, suspicious, fromMs, toMs, bucketSeconds }
export const fetchIncidentReport = async (from, to) =>
  (await axiosInstance.get(`${BASE}/report`, { params: { from: new Date(from).toISOString(), to: new Date(to).toISOString() } })).data.data;

// { visitors, members, windowSeconds } 최근 60초 안에 신호가 있는 접속자(회원 + 비회원)와 로그인 회원. 부하테스트 요청은 서버가 뺀다. Redis 실패면 null
export const fetchMonitorVisitors = async () => (await axiosInstance.get(`${MONITOR}/visitors`)).data.data;
