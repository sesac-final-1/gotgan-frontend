import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { useToastStore } from '@/shared/stores/toastStore';
import { axiosInstance } from '@/shared/api/axiosInstance';
import ShopSellerApply from '@/features/store/components/ShopSellerApply';

// 보완 재제출 — 보완요청 화면의 "보완 제출하기" → 제출 내용(submitted, backend #200)으로 채운 폼 → 바뀐 칸만 PATCH (store.md 2-3절)
let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const CATEGORIES = [{ id: 1, name: '식품', nameEn: 'Food', children: [{ id: 101, name: '과일', nameEn: null }] }];
const SUBMITTED = {
  bizType: 'INDIVIDUAL', companyName: '곳간상회', ownerName: '홍길동', bizRegNo: '000-00-00001', ecommerceRegNo: '2026-서울성동-0000',
  managerPhone: '010-0000-1234', managerEmail: 'seller@example.com', businessAddress: '서울시 성동구', categoryId: 1, intro: '<p>소개</p>',
  representativeProducts: [{ name: '감귤', subCategory: '과일', price: 32900 }, { name: '꿀', subCategory: '과일', price: 48000 }],
  expectedMonthlySales: null, salesChannel: null, settlementAccount: { bank: '국민은행', number: '000000-00-000000', holder: '홍길동' }, marketingAgreed: false,
  documents: [{ docType: 'BUSINESS_REG', originalName: 'biz.pdf', uploadedAt: '2026-10-22T14:05:11+09:00' },
    { docType: 'ECOMMERCE_REG', originalName: 'old.pdf', uploadedAt: '2026-10-22T14:05:11+09:00' }],
};
const supplement = (requestedDocs) => ({
  applicationId: 102, applicationNo: 'AP-2610-102', status: 'SUPPLEMENT', storeName: '곳간상회', slug: 'gotgan-store',
  statusReason: '신고증 사본이 흐립니다', submittedAt: '2026-10-22T14:05:11+09:00', statusChangedAt: '2026-10-23T12:00:00+09:00',
  supplementDueAt: '2026-10-30T12:00:00+09:00', reapplyAvailableAt: null, storeId: null, requestedDocs,
  history: [{ fromStatus: null, toStatus: 'PENDING', actor: 'APPLICANT', reason: null, changedAt: '2026-10-22T14:05:11+09:00' },
    { fromStatus: 'PENDING', toStatus: 'SUPPLEMENT', actor: 'ADMIN', reason: '신고증 사본이 흐립니다', changedAt: '2026-10-23T12:00:00+09:00' }],
  submitted: SUBMITTED,
});
const pending = { ...supplement([]), status: 'PENDING', statusReason: null, supplementDueAt: null, requestedDocs: null };

function stubGet(meFn) {
  return vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url === '/api/categories' ? CATEGORIES : meFn() } }));
}

async function openResubmit() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter><ShopSellerApply /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: '보완 제출하기' }));
  await screen.findByRole('heading', { name: '보완 제출' });
}

const input = (label) => screen.getAllByText(label, { exact: false }).find((el) => el.tagName === 'LABEL').closest('div').querySelector('input, select, textarea');
const type = (label, value) => fireEvent.change(input(label), { target: { value } });
const pdf = (name) => new File(['x'], name, { type: 'application/pdf' });
const lastToast = () => useToastStore.getState().current?.msg;

describe('보완 재제출', () => {
  it('제출 내용으로 채워져 열리고, 요청 서류 없이는 못 냄 → 서류 + 계좌 수정 → 바뀐 칸 · 서류만 PATCH → 심사대기', async () => {
    let me = supplement(['ECOMMERCE_REG']);
    stubGet(() => me);
    vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [{ key: 'applications/5/new.pdf', uploadUrl: 'https://s3/new' }] } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockImplementation(async () => { me = pending; return { data: { data: { applicationId: 102, status: 'PENDING' } } }; });
    const put = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', put);
    await openResubmit();

    // 제출 내용이 채워져 있음 · 요청 서류 칸에 지금 낸 파일
    expect(input('상호명')).toHaveValue('곳간상회');
    expect(input('계좌번호')).toHaveValue('000000-00-000000');
    expect(screen.getByLabelText('스토어 주소')).toHaveValue('gotgan-store');
    expect(screen.getByText('지금 낸 파일: old.pdf')).toBeInTheDocument();
    expect(screen.queryByLabelText('사업자등록증')).toBeNull(); // 요청 안 한 서류는 칸이 없음
    expect(screen.getByText('고친 항목 1개')).toBeInTheDocument(); // 요청 서류 1

    fireEvent.click(screen.getByRole('button', { name: '보완 제출하기' }));
    expect(lastToast()).toBe('통신판매업 신고증을 다시 올려 주세요');

    fireEvent.change(screen.getByLabelText('통신판매업 신고증'), { target: { files: [pdf('new.pdf')] } });
    type('계좌번호', '111-111-111');
    fireEvent.click(screen.getByRole('button', { name: '보완 제출하기' }));

    expect(await screen.findByText('입점 신청을 심사하고 있습니다')).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith('https://s3/new', expect.objectContaining({ method: 'PUT' }));
    expect(patch).toHaveBeenCalledWith('/api/seller/apply/102/resubmit', {
      settlementAccount: { bank: '국민은행', number: '111-111-111', holder: '홍길동' },
      documents: [{ docType: 'ECOMMERCE_REG', key: 'applications/5/new.pdf', originalName: 'new.pdf' }],
    });
  });

  it('사업자등록번호를 바꾸면 사업자등록증 칸이 생기고 필수, 형식이 틀리면 서버와 같은 문구', async () => {
    stubGet(() => supplement([]));
    await openResubmit();
    expect(screen.getByText('다시 낼 서류는 없어요. 아래에서 고칠 내용만 수정해 주세요.')).toBeInTheDocument();

    type('사업자등록번호', '0000000002');
    fireEvent.click(screen.getByRole('button', { name: '보완 제출하기' }));
    expect(lastToast()).toBe('사업자등록번호는 000-00-00000 형식입니다.');

    type('사업자등록번호', '000-00-00002');
    expect(screen.getByLabelText('사업자등록증')).toBeInTheDocument();
    expect(screen.getByText('지금 낸 파일: biz.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '보완 제출하기' }));
    expect(lastToast()).toBe('사업자등록증을 다시 올려 주세요');
  });

  it('내용 보완인데 아무것도 안 고치면 {} 로 "확인" 접수', async () => {
    let me = supplement([]);
    stubGet(() => me);
    const patch = vi.spyOn(axiosInstance, 'patch').mockImplementation(async () => { me = pending; return { data: { data: { status: 'PENDING' } } }; });
    await openResubmit();
    expect(screen.getByText('고친 항목 없음 — 확인만 제출돼요')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '보완 제출하기' }));

    expect(await screen.findByText('입점 신청을 심사하고 있습니다')).toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith('/api/seller/apply/102/resubmit', {});
  });

  it('409 APPLY_INVALID_STATUS(기한 지남) → 서버 문구 토스트 · 상태 다시 조회 → 반려 화면, 취소는 보완요청 화면으로', async () => {
    let me = supplement([]);
    stubGet(() => me);
    vi.spyOn(axiosInstance, 'patch').mockImplementation(async () => {
      me = { ...supplement([]), status: 'REJECTED', statusReason: '보완 기한이 지나 자동 반려되었습니다', reapplyAvailableAt: '2099-01-01T12:00:00+09:00' };
      throw { response: { status: 409, data: { code: 'APPLY_INVALID_STATUS', message: '보완 기한이 지났습니다.' } } };
    });
    await openResubmit();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(await screen.findByText('보완이 필요한 항목이 있습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '보완 제출하기' }));
    await screen.findByRole('heading', { name: '보완 제출' });

    type('상호명', '곳간상회2');
    fireEvent.click(screen.getByRole('button', { name: '보완 제출하기' }));

    await waitFor(() => expect(lastToast()).toBe('보완 기한이 지났습니다.'));
    expect(await screen.findByText('입점 신청이 반려되었습니다')).toBeInTheDocument();
  });
});
