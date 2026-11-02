// product 도메인 API — 담당 박지연. 공개 API(카테고리 · 목록 · 상세)는 실제 호출, 응답은 화면이 쓰던 목업 필드 이름으로 바꿔 넘긴다 (docs/MOCK-TO-API.md 2절)
// 계약: backend docs/api/product.md 8 · 9 · 10절. 상품 · 스토어 · 카테고리 id 는 숫자다 (목업 'p601' · 's6' · 'fashion' 아님)
import { axiosInstance } from '@/shared/api/axiosInstance';

// GET /api/categories — [{ id, name, nameEn, children[{ id, name, nameEn }] }] 사용 중인 것만 · sortOrder 순. 수수료율은 없음(settlement 소관, 관리자 화면만 admin 이 합침)
export const toCategory = (c) => ({
  id: c.id,
  name: c.name,
  en: c.nameEn ?? '',
  subs: c.children.map((x) => x.name), // 화면이 쓰던 하위 이름 배열
  children: c.children.map(({ id, name }) => ({ id, name })), // 목록 조회 categoryId(하위) 용
});

export const fetchCategories = async () => (await axiosInstance.get('/api/categories')).data.data.map(toCategory);

// 상태 문구 — 목록은 노출 가능 상품만 오므로 품절 · 판매중, 상세는 purchasable=false 면 판매중지(화면 "현재 구매할 수 없는 상품")
const statusOf = ({ purchasable = true, soldOut }) => (!purchasable ? '판매중지' : soldOut ? '품절' : '판매중');

// 목록 · 상세 공통 — 목업에만 있던 값(별점 · 리뷰 수 · 판매량 · 태그)은 기본값: 별점 · 리뷰 수는 화면이 review API(GET /api/reviews/ratings/products?ids=)로 붙인다
const common = (r) => ({
  id: r.productId,
  storeId: r.storeId,
  cat: r.topCategoryId, // 상위 카테고리 id
  catId: r.categoryId, // 하위 카테고리 id
  name: r.name,
  price: r.price,
  discount: Number(r.discountRate ?? 0) / 100, // 15.00(%) → 0.15 — 화면 salePrice() · Price 가 비율을 쓴다
  salePrice: r.salePrice, // 서버 계산 판매가(10원 단위 반올림) — 화면 salePrice(p) 와 같은 값
  status: statusOf(r),
  soldOut: r.soldOut,
  created: new Date(r.createdAt),
  rating: 0,
  reviews: 0,
  sold: 0,
  tags: [],
});

// GET /api/products 한 건 — ProductSummary { productId, name, storeId, categoryId, topCategoryId, price, discountRate, salePrice, imageUrl, soldOut, createdAt }
export const toProductCard = (r) => ({ ...common(r), images: r.imageUrl ? [r.imageUrl] : [], options: [] });

// 서버 페이징 목록 · 검색 — params { categoryId(상위면 하위 전부), storeId, q, minPrice, maxPrice(미포함), excludeSoldOut, sort(NEW · PRICE_ASC · PRICE_DESC), page(0부터), size(최대 100) }
// 비어 있는 값은 보내지 않는다 → 응답 { content[], page, size, totalElements, totalPages, hasNext }
export const fetchProducts = async (params = {}) => {
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const page = (await axiosInstance.get('/api/products', { params: query })).data.data;
  return { ...page, content: page.content.map(toProductCard) };
};

// 셀렉트용 옵션 축 — 목업 모양 [{ name: '컬러', values: ['오트밀', '화이트'] }]. 옵션 없는 상품(값 null 인 옵션 1개)은 빈 배열
const optionAxes = (r) => [[r.option1Name, 'option1Value'], [r.option2Name, 'option2Value']]
  .filter(([name]) => name)
  .map(([name, key]) => ({ name, values: [...new Set(r.options.map((o) => o[key]).filter((v) => v != null))] }));

// GET /api/products/{id} — 상세. 장바구니는 언제나 productOptionId 로 담으므로 optionItems 에 옵션 조합별 id · 추가금 · 품절을 둔다
export const toProductDetail = (r) => ({
  ...common(r),
  sub: r.categoryName,
  catName: r.topCategoryName,
  description: r.description ?? '', // HTML — 화면은 safeHtml 로 정화해서 표시
  material: r.material ?? '',
  origin: r.origin ?? '',
  images: r.images, // 첫 번째가 대표, 최대 5장
  purchasable: r.purchasable,
  options: optionAxes(r),
  optionItems: r.options.map((o) => ({
    id: o.productOptionId,
    values: [o.option1Value, o.option2Value].filter((v) => v != null), // options 축 순서와 같음
    extraPrice: o.extraPrice,
    soldOut: o.soldOut,
  })),
});

// 없거나 삭제된 상품은 404 PRODUCT_NOT_FOUND · 판매중지 · 스토어 정지 상품도 200 (purchasable=false)
export const fetchProduct = async (productId) => toProductDetail((await axiosInstance.get(`/api/products/${productId}`)).data.data);

// ── 판매자 상품 (product.md 11 · 15 · 16절) — SELLER, 게이트웨이가 넣은 X-Store-Id 스토어 상품만 온다
// 화면 상태 탭은 판매중 · 품절 · 판매중지 3개 — BLOCKED(관리자 강제 판매중지)는 판매중지 탭에 사유와 함께 (11절)
export const sellerStatusOf = ({ status, soldOut }) => {
  if (status === 'ON_SALE') return soldOut ? '품절' : '판매중';
  return '판매중지'; // STOPPED · BLOCKED
};

// 쇼핑몰에 안 보이는 이유 중 상태로 드러나지 않는 것만 문구로 — STOPPED · BLOCKED 는 상태 칸에 이미 보인다
const HIDDEN_REASON = { CATEGORY_INACTIVE: '카테고리 사용 중지', STORE_INACTIVE: '스토어 운영 중지' };

// GET /api/seller/products 한 건 — { productId, name, categoryId, categoryName, topCategoryName, price, discountRate, salePrice,
//   imageUrl, totalStock, soldOut, status, statusReason, displayable, hiddenReason, createdAt }
export const toSellerProductRow = (r) => ({
  id: r.productId,
  name: r.name,
  catId: r.categoryId,
  catName: r.topCategoryName,
  sub: r.categoryName,
  price: r.price,
  discount: Number(r.discountRate ?? 0) / 100,
  salePrice: r.salePrice,
  images: r.imageUrl ? [r.imageUrl] : [],
  stock: r.totalStock,
  soldOut: r.soldOut,
  status: sellerStatusOf(r), // 탭 · 필터 값
  pill: r.status === 'BLOCKED' ? '강제중지' : sellerStatusOf(r), // 상태 칸 표시
  blocked: r.status === 'BLOCKED',
  statusReason: r.statusReason ?? '',
  hidden: HIDDEN_REASON[r.hiddenReason] ?? '',
  created: new Date(r.createdAt),
  rating: 0, // 화면이 review 평점 API 로 붙인다 (useRatedProducts)
  reviews: 0,
});

// 전체 조회(페이징 없음) — 탭 개수 · 검색 · 정렬 · 페이징은 화면에서 (컨벤션 4-7)
export const fetchSellerProducts = async () => (await axiosInstance.get('/api/seller/products')).data.data.map(toSellerProductRow);

const API_STATUS = { 판매중: 'ON_SALE', 판매중지: 'STOPPED' };

// PATCH /api/seller/products/status — 판매중지 · 재개 일괄(최대 100개). 건마다 처리 → { success[id], failed[{ productId, code, message }] }
export const updateSellerProductStatus = async ({ productIds, status }) =>
  (await axiosInstance.patch('/api/seller/products/status', { productIds, status: API_STATUS[status] })).data.data;

// DELETE /api/seller/products/{id} — 소프트 삭제. 일괄 삭제는 건마다 호출(데모 규모, 16절)하고 결과를 상태 변경과 같은 모양으로 나눈다
export const deleteSellerProducts = async (productIds) => {
  const results = await Promise.allSettled(productIds.map((id) => axiosInstance.delete(`/api/seller/products/${id}`)));
  return {
    success: productIds.filter((_, i) => results[i].status === 'fulfilled'),
    failed: productIds.flatMap((productId, i) => (results[i].status === 'rejected'
      ? [{ productId, code: results[i].reason?.response?.data?.code ?? null, message: results[i].reason?.response?.data?.message ?? '삭제하지 못했어요' }]
      : [])),
  };
};

// GET /api/seller/products/{id} — 수정 화면용 (12절). 공개 상세(10절) + 상태 · 사유 · 옵션별 재고 · 이미지 { key, url }
// 폼은 요청 모양(13절)에 가까운 값을 쓰므로 이름만 화면 쪽으로 바꾸고 옵션 · 이미지는 그대로 둔다
export const toSellerProductDetail = (r) => ({
  id: r.productId,
  catId: r.categoryId,
  cat: r.topCategoryId,
  name: r.name,
  price: r.price,
  discountRate: Math.round(Number(r.discountRate ?? 0)), // 15.00 → 15 (요청은 0~90 정수)
  description: r.description ?? '',
  material: r.material ?? '',
  origin: r.origin ?? '',
  option1Name: r.option1Name,
  option2Name: r.option2Name,
  options: r.options.map((o) => ({ productOptionId: o.productOptionId, option1Value: o.option1Value, option2Value: o.option2Value, extraPrice: o.extraPrice, stock: o.stock })),
  images: r.images, // [{ key, url }] — 수정 때 key 를 imageKeys 로 그대로 돌려보낸다
  status: sellerStatusOf(r),
  pill: r.status === 'BLOCKED' ? '강제중지' : sellerStatusOf(r),
  statusReason: r.statusReason ?? '',
});

export const fetchSellerProduct = async (productId) => toSellerProductDetail((await axiosInstance.get(`/api/seller/products/${productId}`)).data.data);

// POST /api/seller/products(201) · PUT /api/seller/products/{id}(200) — 옵션 · 이미지 통째로 (13절). 응답은 12절과 같은 모양
export const saveSellerProduct = async ({ productId, request }) => {
  const res = productId
    ? await axiosInstance.put(`/api/seller/products/${productId}`, request)
    : await axiosInstance.post('/api/seller/products', request);
  return toSellerProductDetail(res.data.data);
};

// 이미지 업로드 (17절) — 발급 → 브라우저가 S3 에 직접 PUT → 키를 13절 imageKeys 에. Content-Type · 크기가 서명에 들어간다(입점 서류와 같은 방식)
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']; // upload-guard 허용 형식과 같음
export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export async function uploadProductImages(files) {
  if (files.length === 0) return [];
  const issued = (await axiosInstance.post('/api/seller/products/images/presign', {
    files: files.map((f) => ({ contentType: f.type, size: f.size })),
  })).data.data;
  await Promise.all(issued.map(async ({ uploadUrl }, i) => {
    const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': files[i].type }, body: files[i] });
    if (!res.ok) throw new Error('이미지를 올리지 못했어요. 다시 시도해 주세요.');
  }));
  return issued.map(({ key }) => key);
}

// 임시 — 화면이 쓰던 "상품 전체 배열"(최대 100개, 노출 가능 상품만). useProductsQuery() 를 부르는 화면이 모두
// useProductSearchQuery · useProductQuery · 판매자 상품 목록으로 옮겨 가면 삭제 (docs/MOCK-TO-API.md 5절 임시 훅)
export const fetchProductCards = async () => (await fetchProducts({ size: 100 })).content;
