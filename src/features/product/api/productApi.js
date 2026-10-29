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

// 임시 — 화면이 쓰던 "상품 전체 배열"(최대 100개, 노출 가능 상품만). useProductsQuery() 를 부르는 화면이 모두
// useProductSearchQuery · useProductQuery · 판매자 상품 목록으로 옮겨 가면 삭제 (docs/MOCK-TO-API.md 5절 임시 훅)
export const fetchProductCards = async () => (await fetchProducts({ size: 100 })).content;
