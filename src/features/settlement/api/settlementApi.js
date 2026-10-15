// settlement 도메인 API (판매자 정산) — 담당 구지훈
import { mockResolve } from '@/mocks/mockApi';
import { settlements, pendingThisWeek } from '@/mocks/fixtures/orders';

// TODO(구지훈): GET /api/seller/settlements — 목업은 s1(오롯이 리넨) 정산만
export const fetchSellerSettlements = () => mockResolve(settlements.filter((s) => s.storeId === 's1'));

// TODO(구지훈): GET /api/seller/settlements/pending — 이번 주 집계중 금액
export const fetchSellerPending = () => mockResolve(pendingThisWeek.s1);
