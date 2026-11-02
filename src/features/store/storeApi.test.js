import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchStores, fetchStore, toStoreCard, toStoreHome, fetchMyStore, toMyStore } from '@/features/store/api/storeApi';

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
  it('id 숫자 · storeName → name · categoryId → cat · 등급 한글 · 운영중 고정 · cover null · since Date · followers 0', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [SUMMARY] } });

    const list = await fetchStores();

    expect(get).toHaveBeenCalledWith('/api/stores');
    expect(list).toEqual([{
      id: 1, name: '산골농부 박씨네', slug: 'park-farm', cat: 1, intro: '<p>제주 서귀포에서 3대째 귤 농사를 짓습니다.</p>',
      cover: null, color: '#d0701f', grade: '빅파워', since: new Date('2024-03-23T01:00:00Z'), followers: 0, status: '운영중',
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
