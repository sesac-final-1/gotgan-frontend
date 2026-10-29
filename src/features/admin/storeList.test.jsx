import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test/queryWrapper';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { useAdminStoreListQuery } from '@/features/admin/hooks/useAdminStoreListQuery';

// 관리자 스토어 목록 (backend #172 — store /internal/stores 그대로) + 스토어 평점 (review #160)
const STORES = [
  { storeId: 1, storeName: '산골농부 박씨네', slug: 'park-farm', userId: 2, ownerName: '박영철', bizRegNo: '000-00-00006', grade: 'BIG_POWER',
    status: 'ACTIVE', statusReason: null, createdAt: '2024-03-01T10:00:00+09:00' },
  { storeId: 15, storeName: '볕드는집', slug: 'byeot-house', userId: 205, ownerName: '정다은', bizRegNo: '000-00-00005', grade: 'SPROUT',
    status: 'SUSPENDED', statusReason: '반품 미처리', createdAt: '2025-12-31T10:00:00+09:00' },
];
const RATINGS = [{ storeId: 1, averageRating: 4.62, reviewCount: 37 }, { storeId: 15, averageRating: 0, reviewCount: 0 }];

afterEach(() => vi.restoreAllMocks());

async function load() {
  const { Wrapper } = createWrapper();
  const { result } = renderHook(() => useAdminStoreListQuery(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data;
}

describe('관리자 스토어 목록', () => {
  it('목록을 화면 필드로 바꾸고, 받은 스토어 ID 로 평점을 한 번에 붙인다', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url === '/api/admin/stores' ? STORES : RATINGS } }));

    const rows = await load();

    expect(get).toHaveBeenCalledWith('/api/reviews/ratings/stores', { params: { ids: '1,15' } });
    expect(rows[0]).toMatchObject({ id: '1', name: '산골농부 박씨네', owner: '박영철', bizNo: '000-00-00006', grade: '빅파워', status: '운영중',
      avg: 4.62, reviewCount: 37 });
    expect(rows[0].since).toEqual(new Date('2024-03-01T10:00:00+09:00'));
    expect(rows[1]).toMatchObject({ id: '15', grade: '새싹', status: '정지', statusReason: '반품 미처리', reviewCount: 0 });
  });

  it('평점 조회가 실패해도 목록은 그대로 (평점 없음), 스토어가 없으면 평점을 부르지 않는다', async () => {
    vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => {
      if (url === '/api/admin/stores') return { data: { data: STORES } };
      throw new Error('review 502');
    });
    expect(await load()).toMatchObject([{ id: '1', avg: null, reviewCount: 0 }, { id: '15', avg: null }]);

    vi.restoreAllMocks();
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [] } });
    expect(await load()).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
