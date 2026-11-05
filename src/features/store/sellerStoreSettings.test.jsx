import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { axiosInstance } from '@/shared/api/axiosInstance';
import SellerStoreSettings from '@/features/store/components/SellerStoreSettings';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const MY_STORE = { storeId: 1, storeName: '산골농부 박씨네', status: 'ACTIVE', slug: 'park-farm', ownerName: '박영철', bizRegNo: '000-00-00006', grade: 'BIG_POWER',
  color: '#d0701f', intro: '<p>소개</p>', csPhone: '064-0000-0006', shippingFee: 3000, freeShippingThreshold: 30000, courier: '우체국택배', dispatchNote: '', imageKey: null, imageUrl: null };

describe('판매자 스토어 설정 — 스토어 URL', () => {
  it('지금 사이트 주소 + 스토어 주소(slug)로 실제 열리는 주소를 보여 준다', async () => {
    vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: MY_STORE } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><SellerStoreSettings /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByDisplayValue(`${window.location.host}/store/park-farm`)).toBeInTheDocument();
  });
});
