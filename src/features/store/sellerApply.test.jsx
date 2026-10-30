import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useToastStore } from '@/shared/stores/toastStore';
import { axiosInstance } from '@/shared/api/axiosInstance';
import ShopSellerApply from '@/features/store/components/ShopSellerApply';

// 입점 신청 화면 — 내 신청 상태(store.md 2-2절)에 따라 폼 · 심사대기 · 보완요청 · 반려 · 승인, 제출은 서류 업로드 → POST /api/seller/apply (2 · 2-1절)
let queryClient;
afterEach(async () => {
  if (queryClient) await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  cleanup();
  queryClient = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const CATEGORIES = [
  { id: 3, name: '패션의류', nameEn: 'Apparel', children: [{ id: 301, name: '셔츠', nameEn: null }, { id: 302, name: '팬츠', nameEn: null }] },
  { id: 1, name: '식품', nameEn: 'Food', children: [{ id: 101, name: '과일', nameEn: null }] },
];
const application = (status, extra = {}) => ({
  applicationId: 27, applicationNo: 'AP-2610-027', status, storeName: '곳간상회', slug: 'gotgan-store', statusReason: null,
  submittedAt: '2026-10-22T14:05:11+09:00', statusChangedAt: '2026-10-22T14:05:11+09:00', supplementDueAt: null, reapplyAvailableAt: null, storeId: null, requestedDocs: null,
  history: [{ fromStatus: null, toStatus: 'PENDING', actor: 'APPLICANT', reason: null, changedAt: '2026-10-22T14:05:11+09:00' }], ...extra,
});

/** GET 을 URL 로 — me 는 호출마다 바뀔 수 있어 함수 */
function stubGet(me) {
  const meFn = typeof me === 'function' ? me : () => me;
  return vi.spyOn(axiosInstance, 'get').mockImplementation(async (url) => ({ data: { data: url === '/api/categories' ? CATEGORIES : meFn() } }));
}

function renderApply() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/seller/apply']}>
        <Routes>
          <Route path="/seller/apply" element={<ShopSellerApply />} />
          <Route path="/seller" element={<p>판매자센터 화면</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const file = (name, type) => new File(['x'], name, { type });
/** Field 의 <label> 텍스트로 입력칸 찾기 — label 은 htmlFor 없이 같은 div 안에 있다 */
const field = (label) => screen.getAllByText(label, { exact: false }).find((el) => el.tagName === 'LABEL').closest('div').querySelector('input, select, textarea');
const type = (label, value) => fireEvent.change(field(label), { target: { value } });

describe('내 신청 상태', () => {
  it('신청한 적 없음(null) → 신청 폼 1단계', async () => {
    stubGet(null);
    renderApply();
    expect(await screen.findByRole('heading', { name: '판매자 정보' })).toBeInTheDocument();
  });

  it('심사대기 → 접수번호 · 스토어명 · 타임라인', async () => {
    stubGet(application('PENDING'));
    renderApply();
    expect(await screen.findByText('입점 신청을 심사하고 있습니다')).toBeInTheDocument();
    expect(screen.getByText('AP-2610-027')).toBeInTheDocument();
    expect(screen.getByText('01. 심사대기')).toBeInTheDocument();
    expect(screen.getByText(/신청자/)).toBeInTheDocument();
  });

  it('보완요청 → 사유 · 다시 낼 서류 · 기한, 제출 내용(submitted)이 오면 "보완 제출하기" 버튼', async () => {
    stubGet(application('SUPPLEMENT', { statusReason: '신고증 사본이 흐립니다', supplementDueAt: '2026-10-30T10:00:00+09:00', requestedDocs: ['ECOMMERCE_REG'],
      history: [{ fromStatus: null, toStatus: 'PENDING', actor: 'APPLICANT', reason: null, changedAt: '2026-10-22T14:05:11+09:00' },
        { fromStatus: 'PENDING', toStatus: 'SUPPLEMENT', actor: 'ADMIN', reason: '신고증 사본이 흐립니다', changedAt: '2026-10-23T10:00:00+09:00' }] }));
    renderApply();
    expect(await screen.findByText('보완이 필요한 항목이 있습니다')).toBeInTheDocument();
    expect(screen.getByText(/2026\.10\.30까지/)).toBeInTheDocument();
    expect(screen.getByText('다시 낼 서류: 통신판매업 신고증')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보완 제출하기' })).toBeNull(); // submitted 없음(#200 배포 전) → 버튼 숨김
    expect(screen.getByText('02. 보완요청')).toBeInTheDocument();
  });

  it('반려 → 재신청 가능일이 지났으면 "다시 신청하기" → 폼, 안 지났으면 버튼 없음', async () => {
    stubGet(application('REJECTED', { statusReason: '서류 미비', reapplyAvailableAt: '2026-10-01T00:00:00+09:00' }));
    renderApply();
    expect(await screen.findByText('입점 신청이 반려되었습니다')).toBeInTheDocument();
    expect(screen.getByText('서류 미비')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 신청하기' }));
    expect(await screen.findByRole('heading', { name: '판매자 정보' })).toBeInTheDocument();
    cleanup();

    stubGet(application('REJECTED', { reapplyAvailableAt: '2099-01-01T12:00:00+09:00' }));
    renderApply();
    expect(await screen.findByText(/2099\.01\.01부터/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 신청하기' })).toBeNull();
  });

  it('승인 → 판매자센터 링크 · 재로그인 안내', async () => {
    stubGet(application('APPROVED', { storeId: 3 }));
    renderApply();
    expect(await screen.findByText('입점이 승인되었습니다')).toBeInTheDocument();
    expect(screen.getByText(/다시 로그인하면/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '판매자센터로 →' })).toHaveAttribute('href', '/seller');
  });
});

/** 4단계를 전부 채운다 — 제출 직전까지 */
async function fillAll() {
  await screen.findByRole('heading', { name: '판매자 정보' });
  fireEvent.click(screen.getByRole('button', { name: '법인사업자' }));
  type('상호명', '곳간상회'); type('대표자명', '홍길동'); type('사업자등록번호', '000-00-00001'); type('통신판매업 신고번호', '2026-서울성동-0000');
  type('담당자 휴대폰', '010-0000-1234'); type('담당자 이메일', 'seller@example.com'); type('사업장 주소', '서울시 성동구 성수이로 00');
  fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

  await screen.findByRole('heading', { name: '스토어 · 카테고리 · 판매 예정 상품' });
  type('스토어 이름', '곳간상회');
  fireEvent.change(screen.getByLabelText('스토어 주소'), { target: { value: 'gotgan-store' } });
  fireEvent.click(screen.getByRole('button', { name: /식품/ }));
  const names = screen.getAllByPlaceholderText(/상품명/);
  const prices = screen.getAllByPlaceholderText('예상 판매가');
  fireEvent.change(names[0], { target: { value: '감귤 5kg' } }); fireEvent.change(prices[0], { target: { value: '32900' } });
  fireEvent.change(names[1], { target: { value: '꿀 1.2kg' } }); fireEvent.change(prices[1], { target: { value: '48000' } });
  type('월 예상 매출', 'FROM_5M_TO_20M');
  type('스토어 소개', '제주 서귀포 귤 농가');
  fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

  await screen.findByRole('heading', { name: '서류 제출' });
  fireEvent.change(screen.getByLabelText('사업자등록증'), { target: { files: [file('사업자등록증.pdf', 'application/pdf')] } });
  fireEvent.change(screen.getByLabelText('통신판매업 신고증'), { target: { files: [file('신고증.pdf', 'application/pdf')] } });
  fireEvent.change(screen.getByLabelText('정산 계좌 통장 사본'), { target: { files: [file('통장.jpg', 'image/jpeg')] } });
  fireEvent.change(screen.getByLabelText('대표 상품 사진'), { target: { files: [file('1.jpg', 'image/jpeg')] } });
  expect(screen.getByText(/1\.jpg · 1장/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument(); // 한 장씩 골라도 이어서 올릴 수 있다
  fireEvent.change(screen.getByLabelText('대표 상품 사진'), { target: { files: [file('2.jpg', 'image/jpeg'), file('3.png', 'image/png')] } });
  expect(screen.getByText(/1\.jpg, 2\.jpg, 3\.png · 3장/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));

  await screen.findByRole('heading', { name: '정산 계좌 · 약관' });
  type('은행', '국민은행'); type('계좌번호', '000000-00-000000'); type('예금주', '홍길동');
  for (const t of ['(필수) 곳간 판매자 이용약관', '(필수) 전자금융거래 이용약관', '(필수) 개인정보 수집 및 이용 동의']) fireEvent.click(screen.getByLabelText(t));
}

describe('신청 폼', () => {
  it('빈칸이면 다음 단계로 못 가고 토스트', async () => {
    stubGet(null);
    renderApply();
    await screen.findByRole('heading', { name: '판매자 정보' });
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    expect(useToastStore.getState().current.msg).toBe('필수 항목을 모두 입력해 주세요');
    expect(screen.getByRole('heading', { name: '판매자 정보' })).toBeInTheDocument();
  });

  it('형식이 틀린 칸(사업자번호 · 휴대폰 · 이메일 · 스토어 주소)은 그 단계에서 서버와 같은 문구로 막는다', async () => {
    stubGet(null);
    renderApply();
    await screen.findByRole('heading', { name: '판매자 정보' });
    type('상호명', '곳간상회'); type('대표자명', '홍길동'); type('통신판매업 신고번호', '2026-서울성동-0000'); type('사업장 주소', '서울');
    type('사업자등록번호', '1234567890'); type('담당자 휴대폰', '010-0000-1234'); type('담당자 이메일', 'seller@example.com');
    const next = () => fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    next();
    expect(useToastStore.getState().current.msg).toBe('사업자등록번호는 000-00-00000 형식입니다.');
    type('사업자등록번호', '000-00-00001'); type('담당자 휴대폰', '02-000-0000'); next();
    expect(useToastStore.getState().current.msg).toBe('휴대폰 번호는 010-0000-0000 형식입니다.');
    type('담당자 휴대폰', '010-0000-1234'); type('담당자 이메일', 'seller'); next();
    expect(useToastStore.getState().current.msg).toBe('이메일 형식이 올바르지 않습니다.');
    type('담당자 이메일', 'seller@example.com'); next();

    await screen.findByRole('heading', { name: '스토어 · 카테고리 · 판매 예정 상품' });
    type('스토어 이름', '곳간상회');
    const slug = (v) => fireEvent.change(screen.getByLabelText('스토어 주소'), { target: { value: v } });
    slug('-bad'); next();
    expect(useToastStore.getState().current.msg).toContain('영소문자 · 숫자 · 하이픈 3~30자');
    slug('admin'); next();
    expect(useToastStore.getState().current.msg).toBe('사용할 수 없는 스토어 주소입니다.');
    expect(screen.getByRole('heading', { name: '스토어 · 카테고리 · 판매 예정 상품' })).toBeInTheDocument();
  });

  it('4단계 입력 → 서류 presign · S3 PUT 6건 → POST /api/seller/apply(계약 본문) → 심사대기 화면', async () => {
    let me = null;
    stubGet(() => me);
    const post = vi.spyOn(axiosInstance, 'post').mockImplementation(async (url, body) => {
      if (url === '/api/seller/apply/documents/presign') return { data: { data: body.files.map((f, i) => ({ key: `applications/4/${i}.${f.contentType.split('/')[1]}`, uploadUrl: `https://s3/${i}` })) } };
      me = application('PENDING');
      return { data: { data: { applicationId: 27, applicationNo: 'AP-2610-027', status: 'PENDING', submittedAt: '2026-10-22T14:05:11+09:00' } } };
    });
    const put = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', put);
    renderApply();
    await fillAll();

    fireEvent.click(screen.getByRole('button', { name: '입점 신청하기' }));

    expect(await screen.findByText('입점 신청을 심사하고 있습니다')).toBeInTheDocument();
    expect(put).toHaveBeenCalledTimes(6);
    expect(post.mock.calls[0][1].files.map((f) => f.docType)).toEqual(['BUSINESS_REG', 'ECOMMERCE_REG', 'BANK_COPY', 'PRODUCT_PHOTO', 'PRODUCT_PHOTO', 'PRODUCT_PHOTO']);
    expect(post).toHaveBeenLastCalledWith('/api/seller/apply', {
      bizType: 'CORPORATE', companyName: '곳간상회', ownerName: '홍길동', bizRegNo: '000-00-00001', ecommerceRegNo: '2026-서울성동-0000',
      managerPhone: '010-0000-1234', managerEmail: 'seller@example.com', businessAddress: '서울시 성동구 성수이로 00',
      storeName: '곳간상회', slug: 'gotgan-store', categoryId: 1, intro: '제주 서귀포 귤 농가', expectedMonthlySales: 'FROM_5M_TO_20M', salesChannel: undefined,
      representativeProducts: [{ name: '감귤 5kg', subCategory: '과일', price: 32900 }, { name: '꿀 1.2kg', subCategory: '과일', price: 48000 }],
      settlementAccount: { bank: '국민은행', number: '000000-00-000000', holder: '홍길동' },
      agreements: { sellerTerms: true, electronicFinance: true, privacy: true, marketing: false },
      documents: [
        { docType: 'BUSINESS_REG', key: 'applications/4/0.pdf', originalName: '사업자등록증.pdf' },
        { docType: 'ECOMMERCE_REG', key: 'applications/4/1.pdf', originalName: '신고증.pdf' },
        { docType: 'BANK_COPY', key: 'applications/4/2.jpeg', originalName: '통장.jpg' },
        { docType: 'PRODUCT_PHOTO', key: 'applications/4/3.jpeg', originalName: '1.jpg' },
        { docType: 'PRODUCT_PHOTO', key: 'applications/4/4.jpeg', originalName: '2.jpg' },
        { docType: 'PRODUCT_PHOTO', key: 'applications/4/5.png', originalName: '3.png' },
      ],
    });
  });

  it('409 — 주소 중복이면 서버 메시지 토스트 · 2단계로, 스토어가 이미 있으면 판매자센터로', async () => {
    stubGet(null);
    const reject = (code, message) => Promise.reject({ response: { status: 409, data: { code, message } } });
    vi.spyOn(axiosInstance, 'post').mockImplementation(async (url) => (url === '/api/seller/apply/documents/presign'
      ? { data: { data: Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, uploadUrl: `https://s3/${i}` })) } }
      : reject('APPLY_SLUG_DUPLICATED', '이미 사용 중인 스토어 주소입니다.')));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    renderApply();
    await fillAll();

    fireEvent.click(screen.getByRole('button', { name: '입점 신청하기' }));
    await waitFor(() => expect(useToastStore.getState().current.msg).toBe('이미 사용 중인 스토어 주소입니다.'));
    expect(await screen.findByRole('heading', { name: '스토어 · 카테고리 · 판매 예정 상품' })).toBeInTheDocument();

    // 1인 1스토어 — 이미 스토어가 있으면 판매자센터로
    axiosInstance.post.mockImplementation(async (url) => (url === '/api/seller/apply/documents/presign'
      ? { data: { data: Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, uploadUrl: `https://s3/${i}` })) } }
      : reject('APPLY_STORE_ALREADY_EXISTS', '이미 운영 중인 스토어가 있습니다.')));
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    await screen.findByRole('heading', { name: '서류 제출' });
    fireEvent.click(screen.getByRole('button', { name: '다음 단계' }));
    await screen.findByRole('heading', { name: '정산 계좌 · 약관' });
    fireEvent.click(screen.getByRole('button', { name: '입점 신청하기' }));
    expect(await screen.findByText('판매자센터 화면')).toBeInTheDocument();
  });
});
