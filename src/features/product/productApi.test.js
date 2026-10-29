import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchCategories, fetchProducts, fetchProduct, fetchProductCards, toCategory, toProductCard, toProductDetail } from '@/features/product/api/productApi';
import { salePrice } from '@/shared/utils/format';

afterEach(() => vi.restoreAllMocks());

// product.md 9절 응답 한 건
const SUMMARY = {
  productId: 601, name: '서귀포 노지 햇감귤 5kg', storeId: 1, categoryId: 101, topCategoryId: 1,
  price: 32900, discountRate: 18.0, salePrice: 26980, imageUrl: 'https://img/products/1/a.jpg', soldOut: false, createdAt: '2026-10-25T10:00:00+09:00',
};
// product.md 10절 응답
const DETAIL = {
  productId: 101, storeId: 1, categoryId: 301, categoryName: '셔츠', topCategoryId: 3, topCategoryName: '패션의류',
  name: '프렌치 리넨 오버핏 셔츠', price: 89000, discountRate: 15.0, salePrice: 75650,
  description: '<p>리넨</p>', material: '리넨 100%', origin: '대한민국',
  images: ['https://img/products/1/a.jpg', 'https://img/products/1/b.jpg'],
  option1Name: '컬러', option2Name: '사이즈',
  options: [
    { productOptionId: 10101, option1Value: '오트밀', option2Value: 'M', extraPrice: 0, soldOut: false },
    { productOptionId: 10102, option1Value: '오트밀', option2Value: 'L', extraPrice: 2000, soldOut: true },
    { productOptionId: 10103, option1Value: '화이트', option2Value: 'M', extraPrice: 0, soldOut: false },
  ],
  purchasable: true, soldOut: false, createdAt: '2026-10-20T10:00:00+09:00',
};

describe('fetchCategories — GET /api/categories 를 화면 필드로', () => {
  it('id 숫자 그대로 · nameEn → en · 하위는 이름 배열(subs) + id 포함(children), 수수료는 없음', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [
      { id: 3, name: '패션의류', nameEn: 'Apparel', children: [{ id: 301, name: '셔츠', nameEn: null }, { id: 302, name: '팬츠', nameEn: null }] },
      { id: 6, name: '디지털·가전', nameEn: null, children: [] },
    ] } });

    const cats = await fetchCategories();

    expect(get).toHaveBeenCalledWith('/api/categories');
    expect(cats).toEqual([
      { id: 3, name: '패션의류', en: 'Apparel', subs: ['셔츠', '팬츠'], children: [{ id: 301, name: '셔츠' }, { id: 302, name: '팬츠' }] },
      { id: 6, name: '디지털·가전', en: '', subs: [], children: [] },
    ]);
    expect(toCategory({ id: 1, name: '식품', nameEn: 'Food', children: [] })).not.toHaveProperty('commission');
  });
});

describe('fetchProducts — GET /api/products (서버 페이징) 를 카드 필드로', () => {
  it('비어 있는 조건은 보내지 않고, content 만 변환 · 페이지 정보는 그대로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { content: [SUMMARY], page: 0, size: 8, totalElements: 1, totalPages: 1, hasNext: false } } });

    const page = await fetchProducts({ categoryId: 1, sort: 'NEW', size: 8, q: '', storeId: undefined, minPrice: null });

    expect(get).toHaveBeenCalledWith('/api/products', { params: { categoryId: 1, sort: 'NEW', size: 8 } });
    expect(page).toMatchObject({ page: 0, size: 8, totalElements: 1, totalPages: 1, hasNext: false });
    expect(page.content[0]).toMatchObject({ id: 601, storeId: 1, cat: 1, catId: 101, name: '서귀포 노지 햇감귤 5kg', price: 32900, salePrice: 26980, status: '판매중' });
  });

  it('카드 변환 — 할인율 % → 비율, 대표 이미지 1장 배열, 품절 상태, Date, 목업 전용 값은 기본값', () => {
    const p = toProductCard({ ...SUMMARY, soldOut: true });

    expect(p.discount).toBe(0.18);
    expect(salePrice(p)).toBe(p.salePrice); // 화면 계산(10원 반올림)과 서버 판매가가 같다
    expect(p.images).toEqual(['https://img/products/1/a.jpg']);
    expect(p.status).toBe('품절');
    expect(p.created).toEqual(new Date('2026-10-25T01:00:00Z'));
    expect(p).toMatchObject({ rating: 0, reviews: 0, sold: 0, tags: [], options: [] });
    expect(toProductCard({ ...SUMMARY, imageUrl: null, discountRate: null }).images).toEqual([]);
    expect(toProductCard({ ...SUMMARY, imageUrl: null, discountRate: null }).discount).toBe(0);
  });

  it('임시 전체 배열 — size 100 으로 한 번 불러 content 만', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: { content: [SUMMARY, { ...SUMMARY, productId: 602 }], page: 0, size: 100, totalElements: 2, totalPages: 1, hasNext: false } } });

    const cards = await fetchProductCards();

    expect(get).toHaveBeenCalledWith('/api/products', { params: { size: 100 } });
    expect(cards.map((p) => p.id)).toEqual([601, 602]);
  });
});

describe('fetchProduct — GET /api/products/{id} 를 상세 필드로', () => {
  it('하위 이름 → sub, 상위 이름 → catName, 옵션 축은 목업 모양, 조합별 옵션 id 는 optionItems', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: DETAIL } });

    const p = await fetchProduct(101);

    expect(get).toHaveBeenCalledWith('/api/products/101');
    expect(p).toMatchObject({ id: 101, storeId: 1, cat: 3, catId: 301, sub: '셔츠', catName: '패션의류', discount: 0.15, salePrice: 75650,
      description: '<p>리넨</p>', material: '리넨 100%', origin: '대한민국', images: DETAIL.images, purchasable: true, status: '판매중' });
    expect(p.options).toEqual([{ name: '컬러', values: ['오트밀', '화이트'] }, { name: '사이즈', values: ['M', 'L'] }]);
    expect(p.optionItems).toEqual([
      { id: 10101, values: ['오트밀', 'M'], extraPrice: 0, soldOut: false },
      { id: 10102, values: ['오트밀', 'L'], extraPrice: 2000, soldOut: true },
      { id: 10103, values: ['화이트', 'M'], extraPrice: 0, soldOut: false },
    ]);
  });

  it('옵션 없는 상품(값 null 옵션 1개) → options 빈 배열 · optionItems 1개 · 소재 · 원산지 null 은 빈 문자열', () => {
    const p = toProductDetail({ ...DETAIL, option1Name: null, option2Name: null, material: null, origin: null, description: null,
      options: [{ productOptionId: 20001, option1Value: null, option2Value: null, extraPrice: 0, soldOut: false }] });

    expect(p.options).toEqual([]);
    expect(p.optionItems).toEqual([{ id: 20001, values: [], extraPrice: 0, soldOut: false }]);
    expect(p).toMatchObject({ material: '', origin: '', description: '' });
  });

  it('구매 불가(purchasable=false) 는 판매중지, 구매 가능인데 전부 품절이면 품절', () => {
    expect(toProductDetail({ ...DETAIL, purchasable: false }).status).toBe('판매중지');
    expect(toProductDetail({ ...DETAIL, soldOut: true }).status).toBe('품절');
  });
});
