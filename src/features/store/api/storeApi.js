// store 도메인 API — 담당 박지연. 공개 API(목록 · 스토어 홈)는 실제 호출, 응답은 화면이 쓰던 목업 필드 이름으로 바꿔 넘긴다 (docs/MOCK-TO-API.md 2절)
// 계약: backend docs/api/store.md 14절. 스토어 · 카테고리 id 는 숫자다 (목업 's1' · 'fashion' 아님)
import { axiosInstance } from '@/shared/api/axiosInstance';
import { withRealType } from '@/shared/utils/fileType';

// 화면 표시 문구 — admin/constants 에 같은 표가 있지만 store 가 admin 을 참조하지 않도록 여기 둔다
const GRADE_LABEL = { SPROUT: '새싹', POWER: '파워', BIG_POWER: '빅파워' };
const STATUS_LABEL = { ACTIVE: '운영중', SUSPENDED: '정지', CLOSED: '폐점' };

// 목록 · 홈 공통
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

// 화면 주소 /store/{값} — 숫자면 id(14-2), 아니면 입점 신청 때 정한 스토어 주소 slug(14-3). 숫자만으로 된 slug 는 만들 수 없다
// 없거나 삭제된 스토어는 404 STORE_NOT_FOUND
export const fetchStore = async (idOrSlug) => {
  const path = /^\d+$/.test(String(idOrSlug)) ? idOrSlug : `slug/${encodeURIComponent(idOrSlug)}`;
  return toStoreHome((await axiosInstance.get(`/api/stores/${path}`)).data.data);
};

// GET /api/reviews/ratings/stores?ids= — 스토어 홈 별점(review #160, 공개). store 응답에는 평점이 없어 화면이 따로 묻는다(노션 10/28 안내)
// 리뷰가 없으면 0 · 0, 블라인드 · 삭제 리뷰는 빠진 값
export const fetchStoreRating = async (storeId) => {
  const [r] = (await axiosInstance.get('/api/reviews/ratings/stores', { params: { ids: String(storeId) } })).data.data;
  return { avg: Number(r?.averageRating ?? 0), count: r?.reviewCount ?? 0 };
};

// GET /api/seller/store — 로그인한 판매자의 스토어(X-Store-Id, store.md 13-1). 스토어 홈과 같은 이름 + 판매자만 보는 값
// 정지 · 폐점 스토어도 200(설정 화면이 상태 · 사유를 보여 줌). 상위 카테고리(cat)는 이 응답에 없다
export const toMyStore = (r) => ({
  ...toStoreHome(r),
  statusReason: r.statusReason ?? '',
  imageKey: r.imageKey ?? null, // 수정(13-2) 때 그대로 돌려보냄
});

export const fetchMyStore = async () => toMyStore((await axiosInstance.get('/api/seller/store')).data.data);

// PUT /api/seller/store — 설정 전체를 보냄(13-2). 응답은 13-1 과 같은 모양. 폐점 스토어는 409 STORE_CLOSED
export const updateMyStore = async (request) => toMyStore((await axiosInstance.put('/api/seller/store', request)).data.data);

// 대표 이미지 (13-3) — 발급 → 브라우저가 S3 에 직접 PUT(발급 때와 같은 Content-Type) → 키를 13-2 imageKey 에. 상품 이미지와 같은 방식
export const STORE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const STORE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadStoreImage(picked) {
  const file = await withRealType(picked); // 확장자가 아닌 실제 형식으로 발급 (upload-guard 와 맞춤)
  const { key, uploadUrl } = (await axiosInstance.post('/api/seller/store/image/presign', { contentType: file.type, size: file.size })).data.data;
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!res.ok) throw new Error('이미지를 올리지 못했어요. 다시 시도해 주세요.');
  return key;
}

// PATCH /api/seller/store/close — 폐점(12절, 되돌릴 수 없음) → { storeId, status: 'CLOSED', closedAt }
// 409 STORE_ORDERS_IN_PROGRESS · STORE_SETTLEMENT_OUTSTANDING 은 서버 메시지("진행 중인 주문 n건…")를 그대로 보여 준다
export const closeMyStore = async () => {
  const r = (await axiosInstance.patch('/api/seller/store/close')).data.data;
  return { ...r, closedAt: new Date(r.closedAt) };
};

// GET /api/seller/dashboard (15절) — order · product · settlement 통계를 그대로 담고, 못 받은 영역은 null + unavailable[]
// 화면 이름으로: 날짜는 KST 자정 Date, 영역이 null 이면 그대로 null(화면은 그 카드만 "일시적으로 불러올 수 없음")
const kstDate = (ymd) => new Date(`${ymd}T00:00:00+09:00`);
export const toSellerDashboard = (r) => ({
  unavailable: r.unavailable ?? [],
  todaySales: r.order ? r.order.todaySalesAmt : null,
  daily: r.orderDaily ? r.orderDaily.map((d) => ({ date: kstDate(d.date), amount: d.tradeAmt, orders: d.orderCount })) : null, // 오래된 날부터 30일
  product: r.product && {
    onSale: r.product.onSaleCount, lowStock: r.product.lowStockCount, soldOut: r.product.soldOutCount, stopped: r.product.stoppedCount,
    lowStockProducts: r.product.lowStockProducts.map((p) => ({ id: p.productId, name: p.name, stock: p.stock, image: p.imageUrl })),
  },
  settlement: r.settlement && {
    pendingCount: r.settlement.pendingItemCount,
    pendingPayout: r.settlement.pendingPayoutAmt,
    nextPayout: r.settlement.nextPayout && { payout: r.settlement.nextPayout.payoutAmt, pay: kstDate(r.settlement.nextPayout.scheduledPayDate) },
  },
});

export const fetchSellerDashboard = async () => toSellerDashboard((await axiosInstance.get('/api/seller/dashboard')).data.data);
