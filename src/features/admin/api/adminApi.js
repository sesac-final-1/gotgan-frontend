// admin 도메인 API — 담당 구지훈. 관리자 화면은 /api/admin/**(admin-service)만 호출 (컨벤션 4-2 규칙 1)
import { mockResolve } from '@/mocks/mockApi';
import { categories, stores, products } from '@/mocks/fixtures/catalog';
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

// TODO(구지훈): GET /api/admin/products (스토어별 상품 · 상태 — 상품 수 · 상세 표 · 리뷰 상품명)
export const fetchAdminProducts = () => mockResolve(products);

// TODO(구지훈): PATCH /api/admin/applications/{id} { status, reason } → store-service 상태 변경 + 이력 기록 (승인 시 StoreApproved 발행)
// 목업: 메모리의 목업 데이터를 직접 바꾸고 이력을 한 줄 추가 (새로고침하면 초기화)
export const decideApplication = ({ id, status, reason }) => {
  const app = applications.find((a) => a.id === id);
  const from = app.status;
  Object.assign(app, { status, decided: new Date() });
  applicationHistory.unshift({ id: `AH-${Date.now()}`, appId: id, storeName: app.storeName, at: new Date(), from, to: status, by: '곳간 운영팀 · 정다은', reason });
  return mockResolve({ id, status });
};
