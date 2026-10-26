import { useMutation } from '@tanstack/react-query';
import { createReport } from '@/features/report/api/reportApi';

// 신고 · 판매자 검토 요청 — 담당 구지훈. 화면이 바로 다시 불러올 목록이 없어 무효화는 하지 않는다
// 사용: const report = useCreateReportMutation(); report.mutate({ targetType: 'REVIEW', targetId, reasonCode, detail }, { onSuccess, onError })
export function useCreateReportMutation() {
  return useMutation({ mutationFn: createReport });
}
