import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSystemEvents, fetchSystemMetrics, fetchSystemStatus, killService } from '@/features/admin/api/systemApi';

// 장애 시연 화면 — 담당 박지연. 폴링은 탭이 안 보이면 멈춘다(react-query 기본). 실패해도 마지막 값(data)은 남아 '연결 끊김' 과 함께 보여 준다.
// 다음 폴링이 곧 다시 물어보므로 재시도는 하지 않는다
export const STATUS_POLL_MS = 2_000;
export const METRICS_POLL_MS = 15_000;
export const EVENTS_POLL_MS = 5_000;

export function useSystemStatusQuery() {
  return useQuery({ queryKey: queryKeys.admin.systemStatus(), queryFn: () => fetchSystemStatus(), refetchInterval: STATUS_POLL_MS, retry: false });
}

export function useSystemMetricsQuery() {
  return useQuery({ queryKey: queryKeys.admin.systemMetrics(), queryFn: () => fetchSystemMetrics(), refetchInterval: METRICS_POLL_MS, retry: false });
}

export function useSystemEventsQuery() {
  return useQuery({ queryKey: queryKeys.admin.systemEvents(), queryFn: () => fetchSystemEvents(), refetchInterval: EVENTS_POLL_MS, retry: false });
}

// 내리기 — 성공하면 다음 폴링을 기다리지 않고 바로 다시 조회한다(설계 2절 '거의 즉시')
export function useKillServiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: killService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.system() }),
  });
}
