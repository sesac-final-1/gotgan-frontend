// store 도메인 API — 담당 박지연
import { mockResolve } from '@/mocks/mockApi';
import { stores } from '@/mocks/fixtures/catalog';
import { sellerDaily } from '@/mocks/fixtures/orders';

// TODO(박지연): GET /api/stores
export const fetchStores = () => mockResolve(stores);

// TODO(박지연): GET /api/seller/store (로그인한 판매자의 스토어) — 목업은 s1(오롯이 리넨)
export const fetchMyStore = () => mockResolve(stores.find((s) => s.id === 's1'));

// TODO(박지연): GET /api/seller/dashboard 의 sales.daily[] (최근 30일)
export const fetchSellerDailySales = () => mockResolve(sellerDaily);
