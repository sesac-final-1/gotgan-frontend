import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/axiosInstance';
import { queryKeys } from '@/shared/api/queryKeys';
import { useToastStore } from '@/shared/stores/toastStore';
import { createAddress, deleteAddress, fetchMyAddresses, markDefaultAddress, updateAddress } from '@/features/user/api/userApi';
import { addressSchema } from '@/features/user/schemas';
import MyAddresses from '@/features/user/components/MyAddresses';

const HOME = { id: 10, label: '집', name: '김곳간', phone: '010-1234-5678', zip: '06236', addr: '서울 강남구 테헤란로 152', detail: '21층', main: true };
const OFFICE = { id: 11, label: '회사', name: '김곳간', phone: '010-1234-5678', zip: '04524', addr: '서울 중구 세종대로 110', detail: null, main: false };
const apiError = (status, code, message) =>
  new AxiosError(message, 'ERR', {}, null, { status, data: { code, message, data: null }, statusText: '', headers: {}, config: {} });

// 우편번호 검색 — embed 하면 바로 결과 하나를 고른 것처럼
const PICKED = { zonecode: '03187', userSelectedType: 'R', roadAddress: '서울 종로구 세종대로 175', jibunAddress: '', bname: '세종로', buildingName: '', apartment: 'N' };

let queryClient;
beforeEach(() => {
  window.kakao = { Postcode: class { constructor(o) { this.o = o; } embed() { this.o.oncomplete(PICKED); } } };
});
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  delete window.kakao;
  vi.restoreAllMocks();
});

// 내 정보는 마이페이지 레이아웃이 불러 둔 것처럼 캐시에 — GET 은 배송지 목록만 (staleTime 무한: 캐시를 다시 부르지 않게)
function renderAddresses(list, me = { id: 4, name: '구매자1', phone: '010-0000-0004' }) {
  const get = vi.spyOn(axiosInstance, 'get');
  (Array.isArray(list[0]) ? list : [list]).forEach((l) => get.mockResolvedValueOnce({ data: { data: l } }));
  get.mockResolvedValue({ data: { data: Array.isArray(list[0]) ? list.at(-1) : list } });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(queryKeys.user.me(), me);
  render(<QueryClientProvider client={queryClient}><MyAddresses /></QueryClientProvider>);
  return get;
}

describe('배송지 API · 스키마', () => {
  it('목록 · 등록 · 수정 · 삭제 · 기본 지정 경로', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: [HOME] } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: OFFICE } });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: OFFICE } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { ...OFFICE, main: true } } });
    await expect(fetchMyAddresses()).resolves.toEqual([HOME]);
    expect(get).toHaveBeenCalledWith('/api/users/me/addresses');
    await createAddress({ label: '회사' });
    expect(post).toHaveBeenCalledWith('/api/users/me/addresses', { label: '회사' });
    await updateAddress(11, { label: '회사' });
    expect(put).toHaveBeenCalledWith('/api/users/me/addresses/11', { label: '회사' });
    await deleteAddress(11);
    expect(del).toHaveBeenCalledWith('/api/users/me/addresses/11');
    await expect(markDefaultAddress(11)).resolves.toMatchObject({ main: true });
    expect(patch).toHaveBeenCalledWith('/api/users/me/addresses/11/main');
  });

  it('스키마 — 우편번호 · 기본 주소는 검색으로, 휴대폰 형식', () => {
    const ok = { label: '집', name: '김', phone: '01012345678', zip: '06236', addr: '서울', detail: '', main: false };
    expect(addressSchema.safeParse(ok).success).toBe(true);
    expect(addressSchema.safeParse({ ...ok, zip: '' }).error.issues[0].message).toBe('주소 검색으로 주소를 선택해주세요');
    expect(addressSchema.safeParse({ ...ok, phone: '02-123-4567' }).success).toBe(false);
  });
});

describe('MyAddresses', () => {
  it('기본 배송지는 삭제 · 기본으로 버튼 없음, 비어 있으면 안내', async () => {
    renderAddresses([HOME, OFFICE]);
    const home = (await screen.findByText(/집 · 김곳간/)).closest('div.border');
    expect(within(home).queryByRole('button', { name: '삭제' })).toBeNull();
    expect(within(home).queryByRole('button', { name: '기본으로' })).toBeNull();
    const office = screen.getByText(/회사 · 김곳간/).closest('div.border');
    expect(within(office).getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('등록 — 주소 검색으로 우편번호 · 주소를 채우고 저장, 목록 다시 불러옴', async () => {
    const get = renderAddresses([[HOME], [HOME, OFFICE]]);
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: OFFICE } });
    fireEvent.click(await screen.findByRole('button', { name: '+ 배송지 추가' }));
    fireEvent.change(screen.getByLabelText('배송지 이름'), { target: { value: '회사' } });
    fireEvent.change(screen.getByLabelText('받는 분'), { target: { value: '김곳간' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '01012345678' } });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByText('주소 검색으로 주소를 선택해주세요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }));
    await waitFor(() => expect(screen.getByLabelText('우편번호')).toHaveValue('03187'));
    expect(screen.getByLabelText('기본 주소')).toHaveValue('서울 종로구 세종대로 175 (세종로)');
    fireEvent.change(screen.getByLabelText('상세 주소'), { target: { value: ' 3층 ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('배송지를 추가했어요'));
    expect(post).toHaveBeenCalledWith('/api/users/me/addresses', {
      label: '회사', name: '김곳간', phone: '01012345678', zip: '03187', addr: '서울 종로구 세종대로 175 (세종로)', detail: '3층', main: false });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/회사 · 김곳간/)).toBeInTheDocument();
  });

  it('등록 — 연락처는 내 회원정보 휴대폰으로 미리 채워지고 바꿀 수 있음, 수정은 그 배송지 연락처', async () => {
    renderAddresses([HOME, OFFICE], { id: 4, name: '구매자1', phone: '010-9999-0004' });
    fireEvent.click(await screen.findByRole('button', { name: '+ 배송지 추가' }));
    const phone = screen.getByLabelText('연락처');
    expect(phone).toHaveValue('010-9999-0004');
    fireEvent.change(phone, { target: { value: '010-1111-2222' } });
    expect(phone).toHaveValue('010-1111-2222');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    const office = screen.getByText(/회사 · 김곳간/).closest('div.border');
    fireEvent.click(within(office).getByRole('button', { name: '수정' }));
    expect(screen.getByLabelText('연락처')).toHaveValue('010-1234-5678');
  });

  it('등록 — 회원정보에 휴대폰이 없으면(소셜 가입) 빈 칸', async () => {
    renderAddresses([HOME], { id: 4, name: '카카오회원', phone: '' });
    fireEvent.click(await screen.findByRole('button', { name: '+ 배송지 추가' }));
    expect(screen.getByLabelText('연락처')).toHaveValue('');
  });

  it('5개면 추가 버튼 비활성 · 안내', async () => {
    const five = [HOME, ...[1, 2, 3, 4].map((n) => ({ ...OFFICE, id: 20 + n, label: `주소${n}` }))];
    renderAddresses(five);
    expect(await screen.findByText(/최대 5개까지/)).toBeInTheDocument(); // 목록이 온 뒤에 확인
    expect(screen.getByRole('button', { name: '+ 배송지 추가' })).toBeDisabled();
  });

  it('등록 — 서버 409(5개 초과 등)는 폼 아래, 모달 유지', async () => {
    renderAddresses([HOME]);
    vi.spyOn(axiosInstance, 'post').mockRejectedValue(apiError(409, 'ADDRESS_LIMIT_EXCEEDED', '배송지는 최대 5개까지 등록할 수 있습니다.'));
    fireEvent.click(await screen.findByRole('button', { name: '+ 배송지 추가' }));
    fireEvent.change(screen.getByLabelText('배송지 이름'), { target: { value: '회사' } });
    fireEvent.change(screen.getByLabelText('받는 분'), { target: { value: '김곳간' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '01012345678' } });
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }));
    await waitFor(() => expect(screen.getByLabelText('우편번호')).toHaveValue('03187'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('배송지는 최대 5개까지 등록할 수 있습니다.');
    expect(screen.getByLabelText('배송지 이름')).toBeInTheDocument();
  });

  it('수정 — 기존 값으로 열리고 PUT, 409 등 오류는 폼 아래', async () => {
    renderAddresses([HOME, OFFICE]);
    const put = vi.spyOn(axiosInstance, 'put').mockRejectedValue(apiError(404, 'ADDRESS_NOT_FOUND', '배송지를 찾을 수 없습니다.'));
    const office = (await screen.findByText(/회사 · 김곳간/)).closest('div.border');
    fireEvent.click(within(office).getByRole('button', { name: '수정' }));
    expect(screen.getByLabelText('기본 주소')).toHaveValue('서울 중구 세종대로 110');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('배송지를 찾을 수 없습니다.');
    expect(put).toHaveBeenCalledWith('/api/users/me/addresses/11', expect.objectContaining({ label: '회사', detail: '' }));
  });

  it('기본으로 지정 · 삭제 확인 후 DELETE', async () => {
    renderAddresses([HOME, OFFICE]);
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { ...OFFICE, main: true } } });
    const del = vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: {} });
    const office = (await screen.findByText(/회사 · 김곳간/)).closest('div.border');

    fireEvent.click(within(office).getByRole('button', { name: '기본으로' }));
    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('회사을(를) 기본 배송지로 지정했어요'));
    expect(patch).toHaveBeenCalledWith('/api/users/me/addresses/11/main');

    fireEvent.click(within(office).getByRole('button', { name: '삭제' }));
    fireEvent.click(within(screen.getByRole('heading', { name: '배송지 삭제' }).closest('div.bg-white')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(useToastStore.getState().current?.msg).toBe('배송지를 삭제했어요'));
    expect(del).toHaveBeenCalledWith('/api/users/me/addresses/11');
  });

  it('주소 검색 스크립트를 못 불러오면 안내', async () => {
    delete window.kakao;
    renderAddresses([HOME]);
    fireEvent.click(await screen.findByRole('button', { name: '+ 배송지 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '주소 검색' }));
    await act(async () => {
      document.head.querySelector('script[src*="postcode"]')?.onerror();
    });
    expect(await screen.findByText(/주소 검색을 불러오지 못했어요/)).toBeInTheDocument();
  });
});
