// admin 도메인 API — 담당 구지훈. 관리자 화면은 /api/admin/**(admin-service)만 호출 (컨벤션 4-2 규칙 1)
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { DEFAULT_AVATAR } from '@/features/user/constants';
import { toPointRow } from '@/features/user/api/userApi';
import { categories, stores, products } from '@/mocks/fixtures/catalog';
import { applications } from '@/mocks/fixtures/people';
import { settlements, platformDaily } from '@/mocks/fixtures/orders';
import { reviews } from '@/mocks/fixtures/reviews';
import { applicationHistory } from '@/mocks/fixtures/applicationHistory';

// TODO(구지훈): GET /api/admin/dashboard — 조합 · 부분 응답 (가이드라인 03장)
export const fetchAdminDashboard = () => mockResolve({ platformDaily });

// TODO(구지훈): GET /api/admin/applications (전체 1회 로드 — 화면에서 검색 · 정렬, 컨벤션 4-7)
export const fetchApplications = () => mockResolve(applications);

// TODO(구지훈 · 박지연): GET /api/admin/applications/history — store-service store_application_history (10/15 추가)
export const fetchApplicationHistory = () => mockResolve(applicationHistory);

// TODO(구지훈): GET /api/admin/stores
export const fetchAdminStores = () => mockResolve(stores);

// 회원 — admin-service 가 user /internal/users 응답을 그대로 전달 (backend #94). 화면이 쓰던 목업 필드 이름으로 바꿔 넘긴다 (MOCK-TO-API 2절)
const USER_STATUS_LABEL = { ACTIVE: '정상', SUSPENDED: '이용정지' };
const toDate = (v) => (v ? new Date(v) : null);
export const toAdminUser = (r) => ({
  id: String(r.userId), // 라우트 /admin/users/:id 와 같은 문자열
  name: r.name,
  nick: r.nick ?? '',
  email: r.email,
  phone: r.phone ?? '', // 상세에만
  grade: r.grade,
  status: USER_STATUS_LABEL[r.status] ?? r.status,
  signupProvider: r.signupProvider,
  point: r.point,
  spent: r.totalSpent,
  joined: toDate(r.joinedAt),
  lastLogin: toDate(r.lastLoginAt),
  memo: r.statusReason ?? '', // 상세에만 — 마지막 정지 · 해제 사유
  suspendedUntil: toDate(r.suspendedUntil), // 상세에만 — null 이면 영구(정지 중일 때)
  avatar: DEFAULT_AVATAR,
});

// GET /api/admin/users — 서버 페이징(size 최대 100)이지만 데모 규모라 전체 페이지를 모아 화면 페이징 그대로 (컨벤션 4-7)
export const fetchAdminUsers = async () => {
  const rows = [];
  for (let page = 0; ; page += 1) {
    const { content, hasNext } = (await axiosInstance.get('/api/admin/users', { params: { page, size: 100 } })).data.data;
    rows.push(...content);
    if (!hasNext) return rows.map(toAdminUser);
  }
};

// GET /api/admin/users/{id} — 목록 항목 + phone · statusReason · suspendedAt · suspendedUntil
export const fetchAdminUser = async (userId) => toAdminUser((await axiosInstance.get(`/api/admin/users/${userId}`)).data.data);

// GET /api/admin/users/{id}/points — 최신 100건 (이력은 서버 페이징, 화면은 받은 것 안에서 검색 · 정렬). 행 모양은 내 포인트와 같음
export const fetchAdminUserPoints = async (userId) =>
  (await axiosInstance.get(`/api/admin/users/${userId}/points`, { params: { size: 100 } })).data.data.history.content.map(toPointRow);

// PATCH /api/admin/users/{id}/status — 본문은 constants 의 toUserStatusRequest 그대로 ({status, reason, days?}) → 회원 상세
export const changeUserStatus = async ({ userId, request }) =>
  toAdminUser((await axiosInstance.patch(`/api/admin/users/${userId}/status`, request)).data.data);

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
