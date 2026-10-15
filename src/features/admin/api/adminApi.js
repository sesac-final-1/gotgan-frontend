// admin 도메인 API — 담당 구지훈. 관리자 화면은 /api/admin/**(admin-service)만 호출 (컨벤션 4-2 규칙 1)
import { mockResolve } from '@/mocks/mockApi';
import { categories, stores } from '@/mocks/fixtures/catalog';
import { users, applications } from '@/mocks/fixtures/people';
import { settlements, platformDaily } from '@/mocks/fixtures/orders';
import { reviews } from '@/mocks/fixtures/reviews';
import { userPointHistory } from '@/mocks/fixtures/points';
import { applicationHistory } from '@/mocks/fixtures/applicationHistory';

// TODO(구지훈): GET /api/admin/dashboard — 조합 · 부분 응답 (가이드라인 03장)
export const fetchAdminDashboard = () => mockResolve({ platformDaily });

// TODO(구지훈): GET /api/admin/applications (전체 1회 로드 — 화면에서 검색 · 정렬, 컨벤션 4-7)
export const fetchApplications = () => mockResolve(applications);

// TODO(구지훈 · 박지연): GET /api/admin/applications/history — store-service store_application_history (10/15 추가)
export const fetchApplicationHistory = () => mockResolve(applicationHistory);

// TODO(구지훈): GET /api/admin/stores
export const fetchAdminStores = () => mockResolve(stores);

// TODO(구지훈): GET /api/admin/users
export const fetchAdminUsers = () => mockResolve(users);

// TODO(구지훈): GET /api/admin/users/{id}/points
export const fetchAdminUserPoints = (userId) => mockResolve(userPointHistory(users.find((u) => u.id === userId)));

// TODO(구지훈): GET /api/admin/settlements?week=
export const fetchAdminSettlements = () => mockResolve(settlements);

// TODO(구지훈): GET /api/admin/reviews (검토 요청 · 블라인드 포함)
export const fetchAdminReviews = () => mockResolve(reviews);

// TODO(구지훈): GET /api/admin/categories (수수료 · 적용 시작일 포함)
export const fetchAdminCategories = () => mockResolve(categories);
