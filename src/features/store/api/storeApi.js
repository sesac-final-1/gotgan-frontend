// store 도메인 API — 담당 박지연. 공개 API(목록 · 스토어 홈)는 실제 호출, 응답은 화면이 쓰던 목업 필드 이름으로 바꿔 넘긴다 (docs/MOCK-TO-API.md 2절)
// 계약: backend docs/api/store.md 14절. 스토어 · 카테고리 id 는 숫자다 (목업 's1' · 'fashion' 아님)
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { stores } from '@/mocks/fixtures/catalog';
import { sellerDaily } from '@/mocks/fixtures/orders';

// 화면 표시 문구 — admin/constants 에 같은 표가 있지만 store 가 admin 을 참조하지 않도록 여기 둔다
const GRADE_LABEL = { SPROUT: '새싹', POWER: '파워', BIG_POWER: '빅파워' };
const STATUS_LABEL = { ACTIVE: '운영중', SUSPENDED: '정지', CLOSED: '폐점' };

// 목록 · 홈 공통 — 관심고객 수(followers)는 팔로우가 범위 밖이라 0
const common = (r) => ({
  id: r.storeId,
  name: r.storeName,
  slug: r.slug,
  cat: r.categoryId, // 입점 신청 때 고른 상위 카테고리 id — 이름은 카테고리 트리로
  intro: r.intro ?? '', // HTML(서버 정화) — 화면은 safeHtml 로 한 번 더
  cover: r.imageUrl ?? null, // 없으면 null → 화면은 color 아바타
  color: r.color,
  grade: GRADE_LABEL[r.grade] ?? r.grade,
  since: r.createdAt ? new Date(r.createdAt) : null,
  followers: 0,
});

// GET /api/stores 한 줄 — 운영 중 스토어만 오므로 status 는 항상 운영중
export const toStoreCard = (r) => ({ ...common(r), status: '운영중' });

// 운영 중 스토어 전체(개설 최신순, 페이징 없음). 로그인 없이 호출
export const fetchStores = async () => (await axiosInstance.get('/api/stores')).data.data.map(toStoreCard);

// GET /api/stores/{id} — 스토어 홈. 정지 · 폐점은 { storeId, storeName, status } 만 오고 나머지 null → 화면은 status !== '운영중' 이면 안내
// 배송비 · 무료배송 기준은 목업처럼 0 = 없음 (freeShippingThreshold null = 무료배송 없음)
export const toStoreHome = (r) => ({
  ...common(r),
  status: STATUS_LABEL[r.status] ?? r.status,
  owner: r.ownerName ?? '',
  bizNo: r.bizRegNo ?? '',
  phone: r.csPhone ?? '',
  shipFee: r.shippingFee ?? 0,
  freeOver: r.freeShippingThreshold ?? 0,
  courier: r.courier ?? '',
  dispatch: r.dispatchNote ?? '',
});

// 없거나 삭제된 스토어는 404 STORE_NOT_FOUND
export const fetchStore = async (storeId) => toStoreHome((await axiosInstance.get(`/api/stores/${storeId}`)).data.data);

// TODO(박지연): GET /api/seller/store (로그인한 판매자의 스토어) — 목업은 s1(오롯이 리넨). 판매자 스토어 설정 화면 작업 때 교체
export const fetchMyStore = () => mockResolve(stores.find((s) => s.id === 's1'));

// TODO(박지연): GET /api/seller/dashboard 의 sales.daily[] (최근 30일)
export const fetchSellerDailySales = () => mockResolve(sellerDaily);
