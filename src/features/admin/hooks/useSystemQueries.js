import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import {
  fetchIncidentReport, fetchLoadTest, fetchMonitorCalls, fetchMonitorVisitors, fetchMonitorErrors, fetchMonitorOverview, fetchMonitorSummary, fetchMonitorTrace,
  fetchSystemEvents, fetchSystemMetrics, fetchSystemStatus, killOneEach, killService,
  prepareLoadTestAccounts, scaleLoadTest, startLoadTest, stopLoadTest,
} from '@/features/admin/api/systemApi';

// 장애 시연 화면 — 담당 박지연. 폴링은 탭이 안 보이면 멈춘다(react-query 기본). 실패해도 마지막 값(data)은 남아 '연결 끊김' 과 함께 보여 준다.
// 다음 폴링이 곧 다시 물어보므로 재시도는 하지 않는다. 다시 들어왔을 때 옛 상태가 남지 않게 staleTime 0(앱 기본은 1분)
export const STATUS_POLL_MS = 2_000;
export const METRICS_POLL_MS = 15_000;
export const EVENTS_POLL_MS = 5_000;

export function useSystemStatusQuery() {
  return useQuery({ queryKey: queryKeys.admin.systemStatus(), queryFn: () => fetchSystemStatus(), refetchInterval: STATUS_POLL_MS, retry: false, staleTime: 0 });
}

export function useSystemMetricsQuery() {
  return useQuery({ queryKey: queryKeys.admin.systemMetrics(), queryFn: () => fetchSystemMetrics(), refetchInterval: METRICS_POLL_MS, retry: false, staleTime: 0 });
}

export function useSystemEventsQuery() {
  return useQuery({ queryKey: queryKeys.admin.systemEvents(), queryFn: () => fetchSystemEvents(), refetchInterval: EVENTS_POLL_MS, retry: false, staleTime: 0 });
}

// 내리기 — 성공하면 다음 폴링을 기다리지 않고 바로 다시 조회한다(설계 2절 '거의 즉시')
export function useKillServiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: killService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.system() }),
  });
}

// 시나리오(레플리카 2 서비스 1개씩) — 성공하면 바로 다시 조회
export function useKillOneEachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: killOneEach,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.system() }),
  });
}

// ── 부하테스트(11/16) — 실행 중(부하, 계정 준비)엔 1초(k6 가 1초마다 지표 전송), 아니면 10초마다 상태, 그래프를 다시 받는다
export const LOADTEST_RUNNING_POLL_MS = 1_000;
export const LOADTEST_IDLE_POLL_MS = 10_000;
const isRunning = (data) => data?.load?.state === 'RUNNING' || data?.accounts?.state === 'RUNNING';

export function useLoadTestQuery() {
  return useQuery({
    queryKey: queryKeys.admin.systemLoadTest(),
    queryFn: () => fetchLoadTest(),
    refetchInterval: (query) => (isRunning(query.state.data) ? LOADTEST_RUNNING_POLL_MS : LOADTEST_IDLE_POLL_MS),
    retry: false,
    staleTime: 0,
  });
}

function useLoadTestMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemLoadTest() }) });
}

export const useStartLoadTestMutation = () => useLoadTestMutation(startLoadTest);
export const useScaleLoadTestMutation = () => useLoadTestMutation(scaleLoadTest);
export const useStopLoadTestMutation = () => useLoadTestMutation(stopLoadTest);
export const usePrepareAccountsMutation = () => useLoadTestMutation(prepareLoadTestAccounts);

// ── 실시간 모니터링(11/16) — 그래프 2초, 호출, 장애 목록 1초(원본 데이터라 바로 반응), 분석 10초. 보고 있는 탭만 부른다
export const MONITOR_OVERVIEW_POLL_MS = 2_000;
export const MONITOR_LIST_POLL_MS = 1_000;
export const MONITOR_SUMMARY_POLL_MS = 10_000;

const monitorQuery = (part, queryFn, refetchInterval, enabled = true) => ({
  queryKey: queryKeys.admin.systemMonitor(part), queryFn, refetchInterval, enabled, retry: false, staleTime: 0,
});

export const useMonitorOverviewQuery = () => useQuery(monitorQuery('overview', () => fetchMonitorOverview(), MONITOR_OVERVIEW_POLL_MS));
export const useMonitorCallsQuery = (enabled, service) =>
  useQuery(monitorQuery(['calls', service ?? 'all'], () => fetchMonitorCalls(service), MONITOR_LIST_POLL_MS, enabled));
export const useMonitorErrorsQuery = (enabled, service) =>
  useQuery(monitorQuery(['errors', service ?? 'all'], () => fetchMonitorErrors(service), MONITOR_LIST_POLL_MS, enabled));
export const useMonitorSummaryQuery = (enabled) => useQuery(monitorQuery('summary', () => fetchMonitorSummary(), MONITOR_SUMMARY_POLL_MS, enabled));

// 트레이스는 고른 줄만 한 번 — 끝난 요청이라 다시 부르지 않는다
export function useMonitorTraceQuery(traceId) {
  return useQuery({ queryKey: queryKeys.admin.systemMonitor(['trace', traceId]), queryFn: () => fetchMonitorTrace(traceId), enabled: !!traceId, retry: false });
}

// 장애 분석 리포트 — 폴링 없음(기간을 고를 때만). 조회가 몇 초 걸릴 수 있어 같은 기간은 1분 동안 다시 묻지 않는다
export function useIncidentReportQuery(range) {
  return useQuery({
    queryKey: queryKeys.admin.systemReport(range?.from, range?.to),
    queryFn: () => fetchIncidentReport(range.from, range.to),
    enabled: Boolean(range),
    retry: false,
    staleTime: 60_000,
  });
}

// 현재 접속자 — 5초마다 다시 센다(서버는 최근 120초 안에 요청한 사람을 센다)
export const VISITORS_POLL_MS = 5_000;
export const useVisitorsQuery = () => useQuery(monitorQuery('visitors', () => fetchMonitorVisitors(), VISITORS_POLL_MS));
