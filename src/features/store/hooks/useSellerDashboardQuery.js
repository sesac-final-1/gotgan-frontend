import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerDashboard } from '@/features/store/api/storeApi';

// 판매자 대시보드 통계 — 담당 박지연. 한 영역이 실패해도 200 이고 그 영역만 null(unavailable) — 화면이 카드별로 나눠 보여 준다
export function useSellerDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.store.sellerDashboard(),
    queryFn: () => fetchSellerDashboard(),
  });
}
