import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchCategories, fetchProducts, fetchProduct, fetchProductCards, toCategory, toProductCard, toProductDetail,
  fetchSellerProducts, toSellerProductRow, updateSellerProductStatus, deleteSellerProducts,
  fetchSellerProduct, saveSellerProduct, uploadProductImages, updateSellerProductStocks } from '@/features/product/api/productApi';
import { salePrice } from '@/shared/utils/format';
import { cleanParams } from '@/features/product/api/productApi';

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

// product.md 11절 응답 한 건
const SELLER_ROW = {
  productId: 3, name: '프렌치 리넨 오버핏 셔츠', categoryId: 301, categoryName: '셔츠', topCategoryName: '패션의류',
  price: 89000, discountRate: 15.0, salePrice: 75650, imageUrl: 'https://img/products/1/a.jpg', totalStock: 142, soldOut: false,
  status: 'ON_SALE', statusReason: null, displayable: true, hiddenReason: null, createdAt: '2026-10-20T10:00:00+09:00',
};

describe('판매자 상품 목록 — GET /api/seller/products 를 표 행으로', () => {
  it('전체 배열 변환 — 카테고리 이름 · 재고 합계 · 할인 비율 · Date, 평점은 기본값', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [SELLER_ROW] } });

    const rows = await fetchSellerProducts();

    expect(get).toHaveBeenCalledWith('/api/seller/products');
    expect(rows).toEqual([{ id: 3, name: '프렌치 리넨 오버핏 셔츠', catId: 301, catName: '패션의류', sub: '셔츠', price: 89000, discount: 0.15,
      salePrice: 75650, images: ['https://img/products/1/a.jpg'], stock: 142, soldOut: false, status: '판매중', pill: '판매중', blocked: false,
      statusReason: '', hidden: '', created: new Date('2026-10-20T10:00:00+09:00'), rating: 0, reviews: 0 }]);
  });

  it('상태 — 품절 · 판매중지 · 강제중지(판매중지 탭 + 사유), 이미지 없으면 빈 배열', () => {
    expect(toSellerProductRow({ ...SELLER_ROW, soldOut: true })).toMatchObject({ status: '품절', pill: '품절' });
    expect(toSellerProductRow({ ...SELLER_ROW, status: 'STOPPED', hiddenReason: 'STOPPED' })).toMatchObject({ status: '판매중지', pill: '판매중지', hidden: '' });
    expect(toSellerProductRow({ ...SELLER_ROW, status: 'BLOCKED', statusReason: '허위 표시', hiddenReason: 'BLOCKED', imageUrl: null }))
      .toMatchObject({ status: '판매중지', pill: '강제중지', blocked: true, statusReason: '허위 표시', hidden: '', images: [] });
  });

  it('판매중인데 쇼핑몰 미노출 — 카테고리 · 스토어 이유를 문구로', () => {
    expect(toSellerProductRow({ ...SELLER_ROW, displayable: false, hiddenReason: 'CATEGORY_INACTIVE' }).hidden).toBe('카테고리 사용 중지');
    expect(toSellerProductRow({ ...SELLER_ROW, displayable: false, hiddenReason: 'STORE_INACTIVE' }).hidden).toBe('스토어 운영 중지');
  });
});

describe('판매자 상품 변경 — 판매중지 · 재개 일괄 · 삭제', () => {
  it('화면 상태 이름을 API 값으로 보내고 결과(success · failed)를 그대로', async () => {
    const result = { success: [3], failed: [{ productId: 7, code: 'PRODUCT_BLOCKED', message: '관리자가 판매중지한 상품은 재개할 수 없습니다.' }] };
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: result } });

    expect(await updateSellerProductStatus({ productIds: [3, 7], status: '판매중' })).toEqual(result);
    await updateSellerProductStatus({ productIds: [3], status: '판매중지' });

    expect(patch).toHaveBeenNthCalledWith(1, '/api/seller/products/status', { productIds: [3, 7], status: 'ON_SALE' });
    expect(patch).toHaveBeenNthCalledWith(2, '/api/seller/products/status', { productIds: [3], status: 'STOPPED' });
  });

  it('일괄 삭제는 건마다 DELETE — 실패한 건은 서버 코드 · 메시지로 failed 에', async () => {
    const del = vi.spyOn(axiosInstance, 'delete').mockImplementation(async (url) => {
      if (url.endsWith('/9')) throw Object.assign(new Error('404'), { response: { data: { code: 'PRODUCT_NOT_FOUND', message: '상품을 찾을 수 없습니다.' } } });
      if (url.endsWith('/8')) throw new Error('Network Error');
      return { data: { data: null } };
    });

    const result = await deleteSellerProducts([3, 9, 8]);

    expect(del).toHaveBeenCalledTimes(3);
    expect(del).toHaveBeenCalledWith('/api/seller/products/3');
    expect(result).toEqual({ success: [3], failed: [
      { productId: 9, code: 'PRODUCT_NOT_FOUND', message: '상품을 찾을 수 없습니다.' },
      { productId: 8, code: null, message: '삭제하지 못했어요' },
    ] });
  });
});

// product.md 12절 응답 — 10절 + 상태 · 사유 · 옵션별 재고 · 이미지 { key, url }
const SELLER_DETAIL = {
  ...DETAIL, status: 'BLOCKED', statusReason: '허위 표시', hiddenReason: 'BLOCKED', discountRate: 15.0,
  options: [{ productOptionId: 10101, option1Value: '오트밀', option2Value: 'M', extraPrice: 0, soldOut: false, stock: 30 }],
  images: [{ key: 'products/1/a.jpg', url: 'https://img/products/1/a.jpg' }],
};

describe('판매자 상품 상세 · 등록 · 수정', () => {
  it('GET /api/seller/products/{id} — 폼에 쓰는 값으로(할인율 정수 · 옵션 재고 · 이미지 key · 강제중지 사유)', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: SELLER_DETAIL } });

    const p = await fetchSellerProduct(101);

    expect(get).toHaveBeenCalledWith('/api/seller/products/101');
    expect(p).toMatchObject({ id: 101, cat: 3, catId: 301, discountRate: 15, option1Name: '컬러', option2Name: '사이즈',
      images: [{ key: 'products/1/a.jpg', url: 'https://img/products/1/a.jpg' }], status: '판매중지', pill: '강제중지', statusReason: '허위 표시' });
    expect(p.options).toEqual([{ productOptionId: 10101, option1Value: '오트밀', option2Value: 'M', extraPrice: 0, stock: 30 }]);
  });

  it('productId 없으면 POST, 있으면 PUT /{id} — 응답은 상세 모양으로', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { ...SELLER_DETAIL, status: 'ON_SALE', description: null } } });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: SELLER_DETAIL } });
    const request = { name: '리넨 셔츠' };

    expect(await saveSellerProduct({ request })).toMatchObject({ id: 101, status: '판매중', description: '' });
    await saveSellerProduct({ productId: 101, request });

    expect(post).toHaveBeenCalledWith('/api/seller/products', request);
    expect(put).toHaveBeenCalledWith('/api/seller/products/101', request);
  });
});

describe('uploadProductImages — 발급 → S3 PUT → 키', () => {
  afterEach(() => vi.unstubAllGlobals());
  const file = (name, type) => new File(['x'], name, { type });

  it('파일 형식 · 크기로 발급받고, 같은 Content-Type 으로 PUT 한 뒤 키를 순서대로', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [
      { key: 'products/1/a.jpg', uploadUrl: 'https://s3/a' }, { key: 'products/1/b.png', uploadUrl: 'https://s3/b' }] } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const files = [file('a.jpg', 'image/jpeg'), file('b.png', 'image/png')];

    expect(await uploadProductImages(files)).toEqual(['products/1/a.jpg', 'products/1/b.png']);
    expect(post).toHaveBeenCalledWith('/api/seller/products/images/presign', { files: [{ contentType: 'image/jpeg', size: 1 }, { contentType: 'image/png', size: 1 }] });
    expect(fetchMock).toHaveBeenCalledWith('https://s3/b', { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: files[1] });
  });

  it('S3 가 거절하면 오류 · 파일이 없으면 요청 안 함', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [{ key: 'k', uploadUrl: 'https://s3/a' }] } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(uploadProductImages([file('a.jpg', 'image/jpeg')])).rejects.toThrow('이미지를 올리지 못했어요');
    post.mockClear();
    expect(await uploadProductImages([])).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('updateSellerProductStocks — PATCH /api/seller/products/{id}/stocks', () => {
  it('items 그대로 보내고 바꾼 옵션 재고를 돌려받음', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { options: [{ productOptionId: 11, stock: 50 }] } } });
    const items = [{ productOptionId: 11, stock: 50, seenStock: 42 }];

    expect(await updateSellerProductStocks({ productId: 3, items })).toEqual({ options: [{ productOptionId: 11, stock: 50 }] });
    expect(patch).toHaveBeenCalledWith('/api/seller/products/3/stocks', { items });
  });
});

describe('cleanParams — 목록 조회 조건 정리(요청 · 캐시 키 공통)', () => {
  it('undefined · null · 빈 문자열만 빼고, 0 · false 는 남김', () => {
    expect(cleanParams({ q: '', categoryId: undefined, storeId: null, page: 0, excludeSoldOut: false, sort: 'NEW' }))
      .toEqual({ page: 0, excludeSoldOut: false, sort: 'NEW' });
    expect(cleanParams()).toEqual({});
  });
});
