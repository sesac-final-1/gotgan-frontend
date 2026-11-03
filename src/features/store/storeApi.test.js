import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchStores, fetchStore, toStoreCard, toStoreHome, fetchMyStore, toMyStore, updateMyStore, uploadStoreImage, closeMyStore, fetchStoreRating, fetchSellerDashboard, toSellerDashboard } from '@/features/store/api/storeApi';
import { fileOf } from '@/test/fileOf';

afterEach(() => vi.restoreAllMocks());

// store.md 14-1절 한 줄
const SUMMARY = {
  storeId: 1, storeName: '산골농부 박씨네', slug: 'park-farm', categoryId: 1,
  intro: '<p>제주 서귀포에서 3대째 귤 농사를 짓습니다.</p>', imageUrl: null, color: '#d0701f', grade: 'BIG_POWER', createdAt: '2024-03-23T10:00:00+09:00',
};
// store.md 14-2절
const HOME = {
  ...SUMMARY, status: 'ACTIVE', imageUrl: 'https://img/stores/1/a.jpg',
  ownerName: '박영철', bizRegNo: '000-00-00006', csPhone: '064-0000-0006',
  shippingFee: 3000, freeShippingThreshold: 30000, courier: '우체국택배', dispatchNote: '수확일 기준 당일 발송',
};

describe('fetchStores — GET /api/stores 를 화면 필드로', () => {
  it('id 숫자 · storeName → name · categoryId → cat · 등급 한글 · 운영중 고정 · cover null · since Date', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [SUMMARY] } });

    const list = await fetchStores();

    expect(get).toHaveBeenCalledWith('/api/stores');
    expect(list).toEqual([{
      id: 1, name: '산골농부 박씨네', slug: 'park-farm', cat: 1, intro: '<p>제주 서귀포에서 3대째 귤 농사를 짓습니다.</p>',
      cover: null, color: '#d0701f', grade: '빅파워', since: new Date('2024-03-23T01:00:00Z'), status: '운영중',
    }]);
    expect(toStoreCard({ ...SUMMARY, intro: null, grade: 'SPROUT' })).toMatchObject({ intro: '', grade: '새싹' });
  });
});

describe('fetchStore — GET /api/stores/{id} 를 스토어 홈 필드로', () => {
  it('운영 중 — 판매자 정보 · 배송 안내를 목업 이름으로, 대표 이미지 → cover', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: HOME } });

    const s = await fetchStore(1);

    expect(get).toHaveBeenCalledWith('/api/stores/1');
    expect(s).toMatchObject({ id: 1, name: '산골농부 박씨네', status: '운영중', cover: 'https://img/stores/1/a.jpg', grade: '빅파워',
      owner: '박영철', bizNo: '000-00-00006', phone: '064-0000-0006', shipFee: 3000, freeOver: 30000, courier: '우체국택배', dispatch: '수확일 기준 당일 발송' });
  });

  it('무료배송 기준 없음(null) → freeOver 0, 택배사 · 출고 안내 미정 → 빈 문자열 (목업과 같은 의미)', () => {
    const s = toStoreHome({ ...HOME, freeShippingThreshold: null, courier: null, dispatchNote: null });
    expect(s).toMatchObject({ shipFee: 3000, freeOver: 0, courier: '', dispatch: '' });
  });

  it('정지 · 폐점 — 이름 · 상태만 오고 나머지 null → 상태 한글, 빈 값은 기본값', () => {
    const s = toStoreHome({ storeId: 15, storeName: '볕드는집', status: 'SUSPENDED', slug: null, categoryId: null, intro: null, imageUrl: null,
      color: null, grade: null, createdAt: null, ownerName: null, bizRegNo: null, csPhone: null, shippingFee: null, freeShippingThreshold: null, courier: null, dispatchNote: null });
    expect(s).toMatchObject({ id: 15, name: '볕드는집', status: '정지', intro: '', cover: null, since: null, owner: '', shipFee: 0, freeOver: 0 });
    expect(toStoreHome({ storeId: 16, storeName: '닫은집', status: 'CLOSED' }).status).toBe('폐점');
  });
});

describe('fetchMyStore — GET /api/seller/store (13-1절) 를 화면 필드로', () => {
  it('스토어 홈과 같은 이름 + 상태 사유 · 이미지 키, 무료배송 없음(null)은 0 · 비어 있는 값은 빈 문자열', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: {
      storeId: 1, storeName: '산골농부 박씨네', slug: 'park-farm', status: 'ACTIVE', statusReason: null, intro: '<p>지리산 농장</p>',
      imageKey: 'stores/1/a.jpg', imageUrl: 'https://img/stores/1/a.jpg', color: '#5b6b4a', csPhone: '010-0000-0002',
      shippingFee: 3000, freeShippingThreshold: null, courier: null, dispatchNote: null, grade: 'BIG_POWER',
      ownerName: '박농부', bizRegNo: '000-00-00001', createdAt: '2026-10-15T09:00:00+09:00',
    } } });

    const s = await fetchMyStore();

    expect(get).toHaveBeenCalledWith('/api/seller/store');
    expect(s).toMatchObject({ id: 1, name: '산골농부 박씨네', slug: 'park-farm', status: '운영중', statusReason: '', intro: '<p>지리산 농장</p>',
      imageKey: 'stores/1/a.jpg', cover: 'https://img/stores/1/a.jpg', phone: '010-0000-0002', shipFee: 3000, freeOver: 0, courier: '', dispatch: '',
      grade: '빅파워', owner: '박농부', bizNo: '000-00-00001' });
  });

  it('정지 스토어 — 상태 문구와 사유', () => {
    expect(toMyStore({ storeId: 1, storeName: 'x', status: 'SUSPENDED', statusReason: '서류 확인 필요', imageKey: null }))
      .toMatchObject({ status: '정지', statusReason: '서류 확인 필요', imageKey: null });
  });
});

describe('내 스토어 수정 · 대표 이미지 · 폐점', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('PUT /api/seller/store 본문 그대로 · 응답은 내 스토어 모양', async () => {
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: { storeId: 1, storeName: '산골농부 박씨네', status: 'ACTIVE', color: '#2b2b2b', shippingFee: 0, freeShippingThreshold: null } } });
    const request = { color: '#2b2b2b', shippingFee: 0 };

    expect(await updateMyStore(request)).toMatchObject({ id: 1, color: '#2b2b2b', shipFee: 0, freeOver: 0, status: '운영중' });
    expect(put).toHaveBeenCalledWith('/api/seller/store', request);
  });

  it('대표 이미지 — 형식 · 크기로 발급받고 같은 Content-Type 으로 PUT 한 뒤 키, S3 가 거절하면 오류', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: { key: 'stores/1/a.webp', uploadUrl: 'https://s3/a' } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const file = fileOf('a.webp', 'image/webp');

    expect(await uploadStoreImage(file)).toBe('stores/1/a.webp');
    expect(post).toHaveBeenCalledWith('/api/seller/store/image/presign', { contentType: 'image/webp', size: 16 });
    expect(fetchMock).toHaveBeenCalledWith('https://s3/a', { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: file });

    fetchMock.mockResolvedValue({ ok: false });
    await expect(uploadStoreImage(file)).rejects.toThrow('이미지를 올리지 못했어요');
  });

  it('PATCH /api/seller/store/close — 폐점 시각은 Date', async () => {
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { storeId: 1, status: 'CLOSED', closedAt: '2026-11-02T15:00:00+09:00' } } });

    expect(await closeMyStore()).toEqual({ storeId: 1, status: 'CLOSED', closedAt: new Date('2026-11-02T15:00:00+09:00') });
    expect(patch).toHaveBeenCalledWith('/api/seller/store/close');
  });
});

describe('fetchStoreRating — GET /api/reviews/ratings/stores?ids=', () => {
  it('스토어 하나의 평균 · 리뷰 수, 리뷰가 없으면 0', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValueOnce({ data: { data: [{ storeId: 1, averageRating: 4.57, reviewCount: 12 }] } })
      .mockResolvedValueOnce({ data: { data: [] } });

    expect(await fetchStoreRating(1)).toEqual({ avg: 4.57, count: 12 });
    expect(get).toHaveBeenCalledWith('/api/reviews/ratings/stores', { params: { ids: '1' } });
    expect(await fetchStoreRating(2)).toEqual({ avg: 0, count: 0 });
  });
});

describe('판매자 대시보드 — GET /api/seller/dashboard (15절)', () => {
  const DASH = {
    order: { storeId: 1, toConfirmCount: 2, toShipCount: 1, claimCount: 0, inProgressCount: 3, todaySalesAmt: 52000 },
    orderDaily: [{ date: '2026-10-29', tradeAmt: 0, orderCount: 0 }, { date: '2026-10-30', tradeAmt: 26980, orderCount: 1 }],
    product: { onSaleCount: 5, lowStockCount: 1, soldOutCount: 0, stoppedCount: 2, lowStockProducts: [{ productId: 101, name: '햇감귤', stock: 3, imageUrl: 'https://img/a.jpg' }] },
    settlement: { pendingItemCount: 2, pendingPayoutAmt: 48000, nextPayout: { settlementId: 7, week: '2026-W44', payoutAmt: 345600, scheduledPayDate: '2026-11-05', status: 'SCHEDULED' }, recentPaid: [] },
    unavailable: [],
  };

  it('영역별로 화면 이름 — 일별은 KST 자정 Date · 재고 부족 상품 · 다음 지급', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: DASH } });

    expect(await fetchSellerDashboard()).toEqual({
      unavailable: [],
      todaySales: 52000,
      daily: [{ date: new Date('2026-10-29T00:00:00+09:00'), amount: 0, orders: 0 }, { date: new Date('2026-10-30T00:00:00+09:00'), amount: 26980, orders: 1 }],
      product: { onSale: 5, lowStock: 1, soldOut: 0, stopped: 2, lowStockProducts: [{ id: 101, name: '햇감귤', stock: 3, image: 'https://img/a.jpg' }] },
      settlement: { pendingCount: 2, pendingPayout: 48000, nextPayout: { payout: 345600, pay: new Date('2026-11-05T00:00:00+09:00') } },
    });
    expect(get).toHaveBeenCalledWith('/api/seller/dashboard');
  });

  it('못 받은 영역은 null 그대로 · 다음 지급 없음은 null', () => {
    expect(toSellerDashboard({ order: null, orderDaily: null, product: null, settlement: { ...DASH.settlement, nextPayout: null }, unavailable: ['order', 'orderDaily', 'product'] }))
      .toEqual({ unavailable: ['order', 'orderDaily', 'product'], todaySales: null, daily: null, product: null,
        settlement: { pendingCount: 2, pendingPayout: 48000, nextPayout: null } });
  });
});
