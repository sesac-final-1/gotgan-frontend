import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/queryKeys';
import { fetchSellerDailySales } from '@/features/store/api/storeApi';

// 판매자 대시보드 최근 30일 매출 — 담당 박지연. 화면은 이 훅만 쓴다 (API 교체 시 이 파일 · 화면은 그대로, api 파일만 수정)
export function useSellerDailySalesQuery() {
  return useQuery({
    queryKey: queryKeys.store.sellerDailySales(),
    queryFn: () => fetchSellerDailySales(),
  });
}
