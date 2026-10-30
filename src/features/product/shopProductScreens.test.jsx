import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import ShopHome from '@/features/product/components/ShopHome';
import ShopProductList from '@/features/product/components/ShopProductList';
import ShopProductDetail from '@/features/product/components/ShopProductDetail';

// 공개 상품 화면 실제 API 연결 (frontend #60 productApi 후속) — 목록 · 상세 · 메인
const CATEGORIES = [
  { id: 3, name: '패션의류', nameEn: 'Apparel', children: [{ id: 301, name: '셔츠', nameEn: null }, { id: 302, name: '니트', nameEn: null }] },
  { id: 1, name: '식품', nameEn: 'Food', children: [{ id: 101, name: '과일', nameEn: null }] },
];
const card = (productId, name, extra = {}) => ({
  productId, name, storeId: 1, categoryId: 301, topCategoryId: 3, price: 89000, discountRate: 15.0, salePrice: 75650,
  imageUrl: `https://cdn/p/${productId}.jpg`, soldOut: false, createdAt: '2026-10-20T10:00:00+09:00', ...extra,
});
// 공개 스토어 홈 응답 (store.md 14절)
const STORE_HOME = {
  storeId: 1, storeName: '오롯이 리넨', status: 'ACTIVE', slug: 'orot-linen', categoryId: 3, intro: '<p>성수동 리넨 작업실</p>', imageUrl: null, color: '#8c6d4f',
  grade: 'POWER', createdAt: '2025-08-01T10:00:00+09:00', ownerName: '김오롯', bizRegNo: '000-00-00001', csPhone: '02-0000-0001',
  shippingFee: 3500, freeShippingThreshold: 50000, courier: 'CJ대한통운', dispatchNote: '오후 2시 이전 주문 당일 출고',
};
const page = (content, totalPages = 1) => ({ content, page: 0, size: content.length, totalElements: content.length * totalPages, totalPages, hasNext: totalPages > 1 });
const DETAIL = {
  productId: 3, storeId: 1, categoryId: 301, categoryName: '셔츠', topCategoryId: 3, topCategoryName: '패션의류',
  name: '프렌치 리넨 오버핏 셔츠', price: 89000, discountRate: 15.0, salePrice: 75650,
  description: '<p>리넨</p>', material: '리넨 100%', origin: '대한민국', images: ['https://cdn/p/3a.jpg', 'https://cdn/p/3b.jpg'],
  option1Name: '컬러', option2Name: null,
  options: [
    { productOptionId: 11, option1Value: '오트밀', option2Value: null, extraPrice: 0, soldOut: false },
    { productOptionId: 12, option1Value: '차콜', option2Value: null, extraPrice: 2000, soldOut: false },
    { productOptionId: 13, option1Value: '화이트', option2Value: null, extraPrice: 0, soldOut: true },
  ],
  purchasable: true, soldOut: false, createdAt: '2026-10-20T10:00:00+09:00',
};

let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
});

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.pathname + loc.search}</output>;
}

// GET 을 URL 로 나눠 돌려준다 — 상품 목록은 handlers.products(params) 로
function mockApi({ products = () => page([card(3, '리넨 셔츠')]), detail = DETAIL, ratings, store = null, stores = [] } = {}) {
  return vi.spyOn(axiosInstance, 'get').mockImplementation(async (url, opts = {}) => {
    if (url === '/api/categories') return { data: { data: CATEGORIES } };
    if (url === '/api/stores') return { data: { data: stores } };
    if (url.startsWith('/api/stores/')) {
      if (!store) throw Object.assign(new Error('404'), { response: { status: 404 } });
      return { data: { data: store } };
    }
    if (url === '/api/products') return { data: { data: products(opts.params) } };
    if (url.startsWith('/api/products/')) {
      if (!detail) throw Object.assign(new Error('404'), { response: { status: 404 } });
      return { data: { data: detail } };
    }
    if (url === '/api/reviews/ratings/products') {
      const ids = opts.params.ids.split(',').map(Number);
      return { data: { data: ratings ?? ids.map((productId) => ({ productId, averageRating: 4.5, reviewCount: 12 })) } };
    }
    if (url === '/api/reviews/summary') return { data: { data: { averageRating: 4.62, reviewCount: 37, distribution: [], fits: [] } } };
    if (url === '/api/reviews') return { data: { data: page([]) } };
    return { data: { data: page([]) } };
  });
}

function renderAt(path, element, routePath) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={routePath} element={<>{element}<Where /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const productCalls = (get) => get.mock.calls.filter(([url]) => url === '/api/products').map(([, opts]) => opts.params);

describe('상품 목록 — 서버 페이징 · 필터', () => {
  it('URL 조건을 그대로 조회 파라미터로 — 하위 카테고리 우선 · 정렬 매핑 · 별점은 평점 API', async () => {
    const get = mockApi({ products: () => page([card(3, '리넨 셔츠'), card(4, '울 니트')], 3) });
    renderAt('/products?cat=3&sub=302&sort=low&page=1&q=리넨', <ShopProductList />, '/products');

    expect(await screen.findByText('리넨 셔츠')).toBeInTheDocument();
    expect(productCalls(get).at(-1)).toEqual({ categoryId: '302', q: '리넨', sort: 'PRICE_ASC', minPrice: undefined, maxPrice: undefined, excludeSoldOut: undefined, page: 1, size: 24 });
    expect(screen.getByText('6')).toBeInTheDocument(); // 총 개수 = totalElements
    await waitFor(() => expect(screen.getAllByText('★ 4.5')).toHaveLength(2));
    expect(get).toHaveBeenCalledWith('/api/reviews/ratings/products', { params: { ids: '3,4' } });
    expect(screen.getByRole('heading', { name: /리넨/ })).toBeInTheDocument();
  });

  it('정렬 메뉴는 신상품 · 가격 2종, 알 수 없는 정렬은 신상품순', async () => {
    const get = mockApi();
    renderAt('/products?sort=rank', <ShopProductList />, '/products');
    await screen.findByText('리넨 셔츠');
    expect(productCalls(get).at(-1).sort).toBe('NEW');
    expect(screen.queryByText('판매량순')).not.toBeInTheDocument();
    expect(screen.queryByText('리뷰 많은순')).not.toBeInTheDocument();
  });

  it('가격 · 품절 제외는 조회 조건으로, 카테고리를 바꾸면 하위 · 페이지 초기화, 페이지 이동은 URL 로', async () => {
    const get = mockApi({ products: () => page([card(3, '리넨 셔츠')], 3) });
    renderAt('/products?cat=3&sub=301&page=2', <ShopProductList />, '/products');
    await screen.findByText('리넨 셔츠');

    const aside = screen.getAllByText('3만 ~ 8만원')[0];
    fireEvent.click(aside);
    await waitFor(() => expect(productCalls(get).at(-1)).toMatchObject({ minPrice: 30000, maxPrice: 80000, page: 0 }));
    fireEvent.click(screen.getAllByText('15만원 이상')[0]);
    await waitFor(() => expect(productCalls(get).at(-1).minPrice).toBe(150000));
    expect(productCalls(get).at(-1)).not.toHaveProperty('maxPrice'); // 마지막 구간은 상한 없음 — 빈 값은 보내지 않는다
    fireEvent.click(screen.getAllByText('품절 상품 제외')[0]);
    await waitFor(() => expect(productCalls(get).at(-1).excludeSoldOut).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('page=1'));

    fireEvent.click(screen.getAllByRole('button', { name: '식품' })[0]);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/products?cat=1'));
    expect(productCalls(get).at(-1)).toMatchObject({ categoryId: '1', page: 0 });
  });

  it('하위 카테고리 칩 · 빈 결과 안내', async () => {
    mockApi({ products: () => page([]) });
    renderAt('/products?cat=3', <ShopProductList />, '/products');
    expect(await screen.findByText('조건에 맞는 상품이 없어요')).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole('button', { name: '니트' }))[0]);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('cat=3&sub=302'));
    expect(screen.getByText(/패션의류 \/ 니트/)).toBeInTheDocument();
  });
});

describe('상품 상세 — 실제 상품 · 옵션 id 로 담기', () => {
  it('옵션을 고르면 그 조합의 productOptionId · 추가금으로 담는다', async () => {
    mockApi();
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: {} } });
    renderAt('/products/3', <ShopProductDetail />, '/products/:id');

    expect(await screen.findByRole('heading', { level: 1, name: '프렌치 리넨 오버핏 셔츠' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '셔츠' })).toHaveAttribute('href', '/products?cat=3&sub=301');
    await waitFor(() => expect(screen.getByText('리뷰 37개')).toBeInTheDocument()); // 별점은 리뷰 요약 API
    expect(screen.getByText(/장바구니에서 배송비 계산/)).toBeInTheDocument(); // 공개 스토어 API 전 기본 문구

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '차콜' } });
    expect(screen.getByText('(+2,000원)')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: '화이트' } }); // 품절 옵션은 담지 않음 — 아래 담기 본문에 13 이 없음
    fireEvent.click(screen.getByRole('button', { name: '장바구니' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/carts/items', { items: [{ productOptionId: 12, quantity: 1 }] }));
    expect(await screen.findByText('장바구니에 담았어요')).toBeInTheDocument();
  });

  it('옵션 없는 상품은 값 없는 옵션 하나의 id 로 바로 담는다 · 같은 스토어 다른 상품', async () => {
    const single = { ...DETAIL, option1Name: null, options: [{ productOptionId: 21, option1Value: null, option2Value: null, extraPrice: 0, soldOut: false }] };
    const get = mockApi({ detail: single, products: () => page([card(3, '자기 자신'), card(9, '같은 스토어 셔츠')]) });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: {} } });
    renderAt('/products/3', <ShopProductDetail />, '/products/:id');

    await screen.findByRole('heading', { level: 1, name: '프렌치 리넨 오버핏 셔츠' });
    expect(await screen.findByText('같은 스토어 셔츠')).toBeInTheDocument();
    expect(screen.queryByText('자기 자신')).not.toBeInTheDocument();
    expect(productCalls(get)).toContainEqual({ storeId: 1, size: 5 });

    fireEvent.click(screen.getByRole('button', { name: '바로 구매' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/carts/items', { items: [{ productOptionId: 21, quantity: 1 }] }));
  });

  it('구매할 수 없는 상품(purchasable=false)은 담기 · 구매 버튼 대신 안내', async () => {
    mockApi({ detail: { ...DETAIL, purchasable: false } });
    renderAt('/products/3', <ShopProductDetail />, '/products/:id');
    expect(await screen.findByRole('button', { name: '현재 구매할 수 없는 상품입니다' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '장바구니' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('없는 상품(404)은 찾을 수 없음', async () => {
    mockApi({ detail: null });
    renderAt('/products/999', <ShopProductDetail />, '/products/:id');
    expect(await screen.findByText(/상품을 찾을 수 없습니다/)).toBeInTheDocument();
  });
});

describe('상품 상세 — 스토어 정보 (GET /api/stores/{id})', () => {
  it('운영 중 스토어면 이름 · 배송 정책 · 소개(HTML 정화)', async () => {
    mockApi({ store: STORE_HOME });
    renderAt('/products/3', <ShopProductDetail />, '/products/:id');
    await screen.findByRole('heading', { level: 1, name: '프렌치 리넨 오버핏 셔츠' });
    expect(await screen.findByText(/CJ대한통운 · 3,500원/)).toBeInTheDocument();
    expect(screen.getByText('50,000원 이상 구매 시 무료 (스토어 묶음배송)')).toBeInTheDocument();
    expect(screen.getAllByText('성수동 리넨 작업실').length).toBeGreaterThan(0); // <p> 태그가 글자로 보이지 않음
    expect(screen.queryByText(/<p>/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /오롯이 리넨/ })[0]).toHaveAttribute('href', '/store/1');
  });

  it('정지 스토어(상태만 오는 응답)는 기본 문구', async () => {
    mockApi({ store: { storeId: 1, storeName: '오롯이 리넨', status: 'SUSPENDED' } });
    renderAt('/products/3', <ShopProductDetail />, '/products/:id');
    await screen.findByRole('heading', { level: 1, name: '프렌치 리넨 오버핏 셔츠' });
    expect(await screen.findByText(/장바구니에서 배송비 계산/)).toBeInTheDocument();
  });
});

describe('메인 — 카테고리별 신상품 (PRD-14)', () => {
  it('이번 주의 가게 — 공개 스토어 목록의 토담공방 · 그 스토어 상품 3개', async () => {
    const todam = { storeId: 2, storeName: '토담공방', slug: 'todam', categoryId: 2, intro: '<p>전주 도자기 공방</p>', imageUrl: null, color: '#8c6d4f', grade: 'POWER', createdAt: '2025-08-01T10:00:00+09:00' };
    const get = mockApi({ stores: [todam], products: (params) => page(params.storeId === 2 ? [card(204, '다완 찻잔 2인 세트', { storeId: 2 })] : []) });
    renderAt('/', <ShopHome />, '/');
    expect(await screen.findByText('다완 찻잔 2인 세트')).toBeInTheDocument();
    expect(screen.getByText('전주 도자기 공방')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /스토어 방문하기/ })).toHaveAttribute('href', '/store/2');
    expect(productCalls(get)).toContainEqual({ storeId: 2, size: 3 });
  });

  it('첫 상위 카테고리의 신상품 8개, 탭을 누르면 그 카테고리로 · 전체 신상품 · 랭킹 없음', async () => {
    const get = mockApi({
      products: (params) => page(params.categoryId === 1 ? [card(50, '서귀포 감귤', { topCategoryId: 1 })] : params.categoryId === 3 ? [card(3, '리넨 셔츠')] : [card(7, '새로 온 머그')]),
    });
    renderAt('/', <ShopHome />, '/');

    await waitFor(() => expect(productCalls(get)).toContainEqual({ categoryId: 3, sort: 'NEW', size: 8 }));
    expect(productCalls(get)).toContainEqual({ sort: 'NEW', size: 24 });
    expect(await screen.findByText('리넨 셔츠')).toBeInTheDocument();
    expect(screen.getByText('새로 온 머그')).toBeInTheDocument();
    expect(screen.queryByText('지금 가장 많이 담기는 상품')).not.toBeInTheDocument();

    const tabs = screen.getByText('카테고리별 신상품').closest('section');
    fireEvent.click(within(tabs).getByRole('button', { name: '식품' }));
    expect(await screen.findByText('서귀포 감귤')).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: /전체보기/ })).toHaveAttribute('href', '/products?cat=1');
  });

  it('카테고리에 새 상품이 없으면 안내 문구', async () => {
    mockApi({ products: (params) => page(params.categoryId ? [] : [card(7, '새로 온 머그')]) });
    renderAt('/', <ShopHome />, '/');
    expect(await screen.findByText('이 카테고리에 새로 들어온 상품이 아직 없어요.')).toBeInTheDocument();
  });
});
