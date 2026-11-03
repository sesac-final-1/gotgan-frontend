import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/stores/authStore';
import ShopStoreHome from '@/features/store/components/ShopStoreHome';
import ShopStoreList from '@/features/store/components/ShopStoreList';

afterEach(() => vi.restoreAllMocks());

const CATEGORIES = [{ id: 1, name: '식품', nameEn: 'Food', children: [{ id: 101, name: '과일', nameEn: null }, { id: 102, name: '꿀', nameEn: null }] }];
// store.md 14절 · product.md 9절 응답
const STORE = {
  storeId: 1, storeName: '산골농부 박씨네', status: 'ACTIVE', slug: 'park-farm', categoryId: 1, intro: '<p>귤 농사<img src=x onerror="alert(1)"></p>',
  imageUrl: null, color: '#d0701f', grade: 'BIG_POWER', createdAt: '2024-02-26T10:00:00+09:00', ownerName: '박영철', bizRegNo: '000-00-00006',
  csPhone: '064-0000-0006', shippingFee: 3000, freeShippingThreshold: null, courier: '우체국택배', dispatchNote: '수확일 기준 당일 발송',
};
const card = (productId, name, categoryId) => ({ productId, name, storeId: 1, categoryId, topCategoryId: 1, price: 10000, discountRate: 0, salePrice: 10000,
  imageUrl: `https://img/${productId}.jpg`, soldOut: false, createdAt: '2026-10-25T10:00:00+09:00' });
const page = (content) => ({ content, page: 0, size: content.length, totalElements: content.length, totalPages: 1, hasNext: false });

function mockApi({ store = STORE, stores = [] } = {}) {
  return vi.spyOn(axiosInstance, 'get').mockImplementation(async (url, opts = {}) => {
    if (url === '/api/categories') return { data: { data: CATEGORIES } };
    if (url === '/api/stores') return { data: { data: stores } };
    if (url.startsWith('/api/stores/')) {
      if (!store) throw Object.assign(new Error('404'), { response: { status: 404 } });
      return { data: { data: store } };
    }
    if (url === '/api/products') return { data: { data: page([card(101, '햇감귤', 101), card(102, '야생화 꿀', 102)].slice(0, opts.params.size)) } };
    if (url === '/api/reviews/ratings/stores') return { data: { data: [{ storeId: 1, averageRating: 4.5, reviewCount: 12 }] } };
    if (url === '/api/reviews/ratings/products') return { data: { data: [] } };
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderAt(path, element, routePath) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={routePath} element={element} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('스토어 홈 /store/:id — GET /api/stores/{id}', () => {
  it('주소의 id(문자열)로 스토어를 찾고, 그 스토어 상품 · 하위 카테고리 탭 · 별점 · 배송 문구', async () => {
    const get = mockApi();
    renderAt('/store/1', <ShopStoreHome />, '/store/:id');

    expect(await screen.findByRole('heading', { level: 1, name: '산골농부 박씨네' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/stores/1');
    expect(await screen.findByText('햇감귤')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/products', { params: { storeId: 1, sort: 'NEW', size: 100 } });
    expect(screen.getByRole('button', { name: '과일' })).toBeInTheDocument();
    expect(await screen.findByText('(12)')).toBeInTheDocument();
    expect(screen.getByText('우체국택배 · 3,000원')).toBeInTheDocument(); // 무료배송 기준 없음 → "(0원 이상 무료)" 안 붙음
    expect(screen.getByText('귤 농사')).toBeInTheDocument(); // 소개 HTML 이 글자로 찍히지 않고 정화돼서
    expect(document.querySelector('[onerror]')).toBeNull();
  });

  it('문의하기 — 그 스토어 스토어 톡을 열고 스토어 카드, 내 채팅방으로 이동', async () => {
    useAuthStore.setState({ accessToken: 't', user: { userId: 10, name: '김서연', roles: ['BUYER'] }, isAuthReady: true });
    mockApi();
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { roomId: 21, type: 'STORE_INQUIRY', counterpart: { name: '산골농부 박씨네', role: 'SELLER' }, lastMessage: null, unreadCount: 0 } } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/store/1']}>
          <Routes>
            <Route path="/store/:id" element={<ShopStoreHome />} />
            <Route path="/mypage/chats/:roomId" element={<p>구매자 채팅방</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '문의하기' }));
    expect(await screen.findByText('구매자 채팅방')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/api/chats/rooms', { type: 'STORE_INQUIRY', storeId: 1, context: { type: 'STORE', id: 1 } });
    useAuthStore.setState({ accessToken: null, user: null });
  });

  it('없는 스토어(404) · 정지 스토어 안내', async () => {
    mockApi({ store: null });
    renderAt('/store/99', <ShopStoreHome />, '/store/:id');
    expect(await screen.findByText('존재하지 않는 스토어입니다')).toBeInTheDocument();
  });

  it('정지 스토어는 운영하지 않는 스토어 안내', async () => {
    mockApi({ store: { storeId: 15, storeName: '볕드는집', status: 'SUSPENDED' } });
    renderAt('/store/15', <ShopStoreHome />, '/store/:id');
    expect(await screen.findByText('볕드는집은(는) 현재 운영하지 않는 스토어입니다')).toBeInTheDocument();
  });
});

describe('스토어 목록 /stores', () => {
  it('스토어 카드마다 그 스토어 신상품 3장을 공개 목록으로, 카드는 /store/{id} 로', async () => {
    const get = mockApi({ stores: [STORE] });
    renderAt('/stores', <ShopStoreList />, '/stores');

    const link = await screen.findByRole('link', { name: /산골농부 박씨네/ });
    expect(link).toHaveAttribute('href', '/store/1');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/products', { params: { storeId: 1, sort: 'NEW', size: 3 } }));
    await waitFor(() => expect(link.querySelectorAll('img[src^="https://img/"]')).toHaveLength(2)); // 상품 사진만 (소개 HTML 의 이미지 제외)
  });

  it('목록 조회 실패는 다시 시도 안내, 운영 중 가게가 없으면 빈 안내', async () => {
    const get = mockApi();
    const base = get.getMockImplementation();
    let fail = true;
    get.mockImplementation(async (url, opts) => {
      if (url === '/api/stores' && fail) throw new Error('502');
      return base(url, opts);
    });
    renderAt('/stores', <ShopStoreList />, '/stores');

    expect(await screen.findByRole('alert')).toHaveTextContent('가게 목록을 불러오지 못했어요');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('이 카테고리에는 아직 가게가 없어요.')).toBeInTheDocument(); // stores: []
  });
});
