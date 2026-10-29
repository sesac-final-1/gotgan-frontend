// admin 도메인 API — 담당 구지훈. 관리자 화면은 /api/admin/**(admin-service)만 호출 (컨벤션 4-2 규칙 1)
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { DEFAULT_AVATAR } from '@/features/user/constants';
import { toPointRow } from '@/features/user/api/userApi';
import { toSettlementDetail } from '@/features/settlement/api/settlementApi';
import { stores, products } from '@/mocks/fixtures/catalog';
import { settlements } from '@/mocks/fixtures/orders';
import { reviews } from '@/mocks/fixtures/reviews';
import { APPLICATION_STATUS_LABEL, STORE_STATUS_LABEL, STORE_GRADE_LABEL, BIZ_TYPE_LABEL, EXPECTED_SALES_LABEL, ACTOR_LABEL, DOC_TYPES } from '@/features/admin/constants';

// GET /api/admin/dashboard — settlement · order · product 통계 조합, 한 곳이 실패하면 그 영역 null + unavailable[] (backend #95 · #112)
// 일별 거래액: orderDaily [{date: 'YYYY-MM-DD', tradeAmt, orderCount}](최근 30일 · 빈 날 0) → 차트 모양 {date, amount, orders}
export const toDailyBars = (rows) =>
  rows?.map((r) => ({ date: new Date(`${r.date}T00:00:00+09:00`), amount: r.tradeAmt, orders: r.orderCount })) ?? null;
export const fetchAdminDashboard = async () => {
  const data = (await axiosInstance.get('/api/admin/dashboard')).data.data;
  return { ...data, platformDaily: toDailyBars(data.orderDaily) };
};

// 스토어 상세 · 카테고리 수수료(스토어 수)용 목업 — store 1절 확장(관리자 필드 · 상태 이력)이 나오면 상세와 함께 교체
export const fetchAdminStores = () => mockResolve(stores);

// GET /api/admin/stores — store /internal/stores 그대로(backend #172, 개설 최신순 · 페이징 없음) + 스토어 평점(review #160, 1~100개)
// 평점은 화면 보조 정보라 review 가 실패해도 목록은 보여 준다(평점 없음)
export const fetchAdminStoreList = async () => {
  const rows = (await axiosInstance.get('/api/admin/stores')).data.data;
  const ratings = rows.length === 0 ? [] : await axiosInstance
    .get('/api/reviews/ratings/stores', { params: { ids: rows.map((r) => r.storeId).join(',') } })
    .then((res) => res.data.data, () => []);
  const ratingById = Object.fromEntries(ratings.map((r) => [r.storeId, r]));
  return rows.map((r) => ({
    id: String(r.storeId), // 라우트 /admin/stores/:id 와 같은 문자열
    name: r.storeName,
    slug: r.slug,
    owner: r.ownerName,
    bizNo: r.bizRegNo,
    grade: STORE_GRADE_LABEL[r.grade] ?? r.grade,
    status: STORE_STATUS_LABEL[r.status] ?? r.status,
    statusReason: r.statusReason ?? '',
    since: new Date(r.createdAt),
    avg: ratingById[r.storeId]?.averageRating ?? null,
    reviewCount: ratingById[r.storeId]?.reviewCount ?? 0,
  }));
};

// PATCH /api/admin/stores/{id}/status {status: ACTIVE/SUSPENDED, reason(필수)} — store 9절 그대로 (backend #177).
// 같은 상태는 200(멱등) · 폐점 스토어 409 · StoreStatusChanged 로 product 상품 숨김 · settlement 지급 보류
export const changeStoreStatus = async ({ storeId, request }) =>
  (await axiosInstance.patch(`/api/admin/stores/${storeId}/status`, request)).data.data;

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

// GET /api/admin/users/{id}/reviews — review 회원별 목록 그대로(삭제 제외 · 블라인드 포함, 최신순, backend #173). 상세 화면은 최근 5개
export const fetchAdminUserReviews = async (userId) =>
  (await axiosInstance.get(`/api/admin/users/${userId}/reviews`, { params: { size: 5 } })).data.data.content
    .map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));

// PATCH /api/admin/users/{id}/status — 본문은 constants 의 toUserStatusRequest 그대로 ({status, reason, days?}) → 회원 상세
export const changeUserStatus = async ({ userId, request }) =>
  toAdminUser((await axiosInstance.patch(`/api/admin/users/${userId}/status`, request)).data.data);

// 스토어 목록 · 상세 · 대시보드의 8주 추이용 목업 — 스토어 API 로 바꿀 때 함께 교체. 정산 관리 화면은 아래 fetchAdminSettlementWeek
export const fetchAdminSettlements = () => mockResolve(settlements);

// 정산 — admin-service 가 settlement /internal/settlements 응답을 그대로 전달 (backend #94). 목업 필드 이름으로 바꿔 넘긴다
const SETTLEMENT_STATUS_LABEL = { SCHEDULED: '지급예정', HELD: '지급보류', PAID: '지급완료' };
export const toAdminSettlement = (s) => ({
  id: s.id,
  storeId: s.storeId,
  storeName: s.storeName ?? String(s.storeId),
  orders: s.itemCount,
  carriedOver: s.carriedOverCount,
  gross: s.salesAmt,
  rate: s.salesAmt ? s.commissionAmt / s.salesAmt : 0, // 건마다 카테고리 수수료율이 달라 정산서 전체의 실효율
  commission: s.commissionAmt,
  pgFee: s.paymentFeeAmt,
  payout: s.payoutAmt,
  status: SETTLEMENT_STATUS_LABEL[s.status] ?? s.status,
  holdReason: s.holdReason ?? '',
  start: new Date(`${s.weekStart}T00:00:00+09:00`),
  end: new Date(`${s.weekEnd}T00:00:00+09:00`),
  pay: s.paidAt ? new Date(s.paidAt) : new Date(`${s.scheduledPayDate}T00:00:00+09:00`), // 지급했으면 지급 시각, 아니면 지급 예정일(목)
});

// GET /api/admin/stores/{id}/settlements?weeks=8 — settlement 스토어 최근 정산서(backend #184): 이번 주 포함 최근 8주, 최신 주차 먼저 + 합계
export const fetchAdminStoreSettlements = async (storeId) => {
  const d = (await axiosInstance.get(`/api/admin/stores/${storeId}/settlements`, { params: { weeks: 8 } })).data.data;
  return { totals: d.totals, rows: d.settlements.map(toAdminSettlement) };
};

// GET /api/admin/settlements?week=2026-W43 — week 생략 = 지난주. 화면은 고른 주차만 받는다
export const fetchAdminSettlementWeek = async (week) =>
  (await axiosInstance.get('/api/admin/settlements', { params: { week } })).data.data.settlements.map(toAdminSettlement);

// POST /api/admin/settlements/pay {ids} → {success[], failed[{id, code, message}]} — 건마다 따로 커밋
export const paySettlements = async (ids) => (await axiosInstance.post('/api/admin/settlements/pay', { ids })).data.data;

// PATCH /api/admin/settlements/{id}/hold {hold, reason} — hold=true 면 reason 필수
export const holdSettlement = async ({ id, hold, reason }) =>
  (await axiosInstance.patch(`/api/admin/settlements/${id}/hold`, { hold, reason })).data.data;

// GET /api/admin/settlements/{id} — 지급 전 확인: 건별 상품주문 · 수수료율 · 이월 · 상태 이력 (판매자 상세와 같은 모양)
export const fetchAdminSettlement = async (id) => toSettlementDetail((await axiosInstance.get(`/api/admin/settlements/${id}`)).data.data);

// POST /api/admin/settlements/aggregate {week} → {week, created, updated, autoHeld, carriedOver} — 멱등(스토어 × 주차 1건)
export const aggregateSettlements = async (week) => (await axiosInstance.post('/api/admin/settlements/aggregate', { week })).data.data;

// 스토어 목록 · 상세 · 회원 상세의 평점 · 작성 리뷰 표시용 목업 — review 목록 API 가 생기면 교체. 리뷰 신고 · 블라인드는 아래 신고 API
export const fetchAdminReviews = () => mockResolve(reviews);

// 카테고리 · 수수료 — admin-service: product 카테고리(GET /api/admin/categories) + settlement 수수료(GET /api/admin/commissions) (backend #95)
// 스토어 · 상품은 아직 목업이라 목업과 같은 문자열 id(food 등)로 넘긴다 — 시드 상위 1~6 은 고정 번호, 새 카테고리는 숫자 문자열
const CATEGORY_SLUG = { 1: 'food', 2: 'living', 3: 'fashion', 4: 'shoes-bags', 5: 'beauty', 6: 'digital' };
export const toAdminCategory = (c, commission) => ({
  id: CATEGORY_SLUG[c.id] ?? String(c.id),
  categoryId: c.id,
  name: c.name,
  en: c.nameEn ?? '',
  sortOrder: c.sortOrder,
  active: c.active,
  commission: commission?.current ? commission.current.rate / 100 : null, // 목업과 같은 비율(0.11)
  reserved: commission?.reserved ?? [],
  subs: c.children.map((s) => s.name),
  children: c.children,
});

export const fetchAdminCategories = async () => {
  const [tree, commissions] = await Promise.all([
    axiosInstance.get('/api/admin/categories'), axiosInstance.get('/api/admin/commissions'),
  ]);
  const byId = Object.fromEntries(commissions.data.data.map((c) => [c.categoryId, c]));
  return tree.data.data.map((c) => toAdminCategory(c, byId[c.id]));
};

// POST /api/admin/categories — 상위는 commissionRate 필수(수수료 등록 후 켜짐), 하위는 parentId · PUT /{id} — 이름 · 정렬 · 사용 여부
export const saveCategory = async ({ categoryId, request }) =>
  (categoryId ? await axiosInstance.put(`/api/admin/categories/${categoryId}`, request) : await axiosInstance.post('/api/admin/categories', request)).data.data;

// PUT /api/admin/commissions — [{categoryId, rate(%)}], effectiveFrom 생략 = 다음 주 월요일부터
export const reserveCommissions = async (rows) => (await axiosInstance.put('/api/admin/commissions', rows)).data.data;

// TODO(구지훈): GET /api/admin/products (스토어별 상품 · 상태 — 상품 수 · 상세 표 · 리뷰 상품명)
export const fetchAdminProducts = () => mockResolve(products);

// GET /api/admin/stores/{storeId}/products — product 판매자 상품 목록과 같은 응답 그대로 (backend #110 · #112, 삭제 제외 · 상태 무관)
//   [{productId, name, categoryName, salePrice, imageUrl, totalStock, soldOut, status, statusReason, displayable, hiddenReason, createdAt}]
// 스토어 상세(B안 — 스토어 목업)는 store API 교체 때 이 함수로 바꾼다. 지금은 임시 점검 화면(/qa)만 사용
export const fetchAdminStoreProducts = async (storeId) => (await axiosInstance.get(`/api/admin/stores/${storeId}/products`)).data.data;

// PATCH /api/admin/products/{productId}/block {blocked, reason} → {productId, status, statusReason} — 해제하면 STOPPED(판매자가 재개)
export const blockProduct = async ({ productId, blocked, reason }) =>
  (await axiosInstance.patch(`/api/admin/products/${productId}/block`, { blocked, reason })).data.data;

// 입점 심사 — admin-service 가 store /internal/applications 응답 + categoryName 을 그대로 전달 (backend #98, store.md 3 ~ 7절)
const appStatus = (v) => (v ? APPLICATION_STATUS_LABEL[v] ?? v : null);
const DOC_LABEL = Object.fromEntries(DOC_TYPES.map((d) => [d.value, d.label]));

export const toApplicationRow = (r) => ({
  id: String(r.applicationId), // 라우트 /admin/applications/:id
  no: r.applicationNo,
  storeName: r.storeName,
  owner: r.ownerName,
  categoryId: r.categoryId,
  catName: r.categoryName ?? String(r.categoryId),
  bizType: BIZ_TYPE_LABEL[r.bizType] ?? r.bizType,
  expected: EXPECTED_SALES_LABEL[r.expectedMonthlySales] ?? '-',
  applied: toDate(r.submittedAt),
  status: appStatus(r.status),
});

export const toApplication = (r) => ({
  ...toApplicationRow(r),
  note: r.statusReason ?? '', // 보완요청 · 반려 사유
  storeId: r.storeId,
  companyName: r.companyName,
  bizNo: r.bizRegNo,
  ecomNo: r.ecommerceRegNo,
  phone: r.managerPhone,
  email: r.managerEmail,
  address: r.businessAddress,
  slug: r.slug,
  intro: r.intro ?? '', // 판매자가 쓴 HTML — 화면은 safeHtml 로 한 번 더 정화해 서식을 살려 보여 준다
  products: r.representativeProducts ?? [],
  channel: r.salesChannel ?? '-',
  account: r.settlementAccount,
  documents: (r.documents ?? []).map((d) => ({ ...d, label: DOC_LABEL[d.docType] ?? d.docType })),
  history: (r.history ?? []).map((h) => ({ from: appStatus(h.fromStatus), to: appStatus(h.toStatus), by: ACTOR_LABEL[h.actor] ?? h.actor, reason: h.reason ?? '', at: toDate(h.changedAt) })),
  sameBizRegNo: { applications: r.sameBizRegNo?.applications ?? [], stores: r.sameBizRegNo?.stores ?? [] },
});

// GET /api/admin/applications — 전체 배열(페이징 없음), 탭 · 검색 · 정렬은 화면에서 (컨벤션 4-7)
export const fetchApplications = async () => (await axiosInstance.get('/api/admin/applications')).data.data.map(toApplicationRow);

// GET /api/admin/applications/{id} — 서류 링크는 presigned 10분, 만료되면 상세를 다시 조회
export const fetchApplication = async (id) => toApplication((await axiosInstance.get(`/api/admin/applications/${id}`)).data.data);

// PATCH /api/admin/applications/{id}/approve (본문 없음) · /reject {reason} · /supplement {message, requestedDocs[]}
export const decideApplication = async ({ id, action, body }) =>
  (await axiosInstance.patch(`/api/admin/applications/${id}/${action}`, body)).data.data;

// 신고 — admin-service 가 직접 갖는 신고 · 조치 이력 (backend #106, docs/api/admin.md). 리뷰 블라인드 · 회원 정지도 여기서
const at = (v) => (v ? new Date(v) : null);
const toActionRow = (a) => a && { ...a, createdAt: at(a.createdAt) };

// GET /api/admin/reports?targetType= — 대상별 묶음(처리 대기 많은 순), 전체 배열
export const fetchAdminReports = async () =>
  (await axiosInstance.get('/api/admin/reports')).data.data.map((t) => ({
    ...t, id: `${t.targetType}-${t.targetId}`, lastReportedAt: at(t.lastReportedAt), lastAction: toActionRow(t.lastAction),
  }));

// GET /api/admin/reports/{type}/{id} — 신고 · 조치 이력 + 대상 현재 값(못 불러오면 target null + targetError)
export const fetchAdminReport = async ({ type, id }) => {
  const d = (await axiosInstance.get(`/api/admin/reports/${type}/${id}`)).data.data;
  return { ...d, reports: d.reports.map((r) => ({ ...r, createdAt: at(r.createdAt) })), actions: d.actions.map(toActionRow) };
};

// POST /api/admin/reports/{type}/{id}/resolve {action, reason, days?} → {action, closedReports, target}
export const resolveReport = async ({ type, id, action, reason, days }) =>
  (await axiosInstance.post(`/api/admin/reports/${type}/${id}/resolve`, { action, reason, ...(days ? { days } : {}) })).data.data;
