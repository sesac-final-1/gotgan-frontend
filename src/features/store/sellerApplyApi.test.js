import { axiosInstance } from '@/shared/api/axiosInstance';
import { fetchMyApplication, toMyApplication, uploadApplyDocuments, applySeller, resubmitApplication } from '@/features/store/api/sellerApplyApi';

afterEach(() => vi.restoreAllMocks());

// store.md 2-2절
const ME = {
  applicationId: 27, applicationNo: 'AP-2610-027', status: 'SUPPLEMENT', storeName: '곳간상회', slug: 'gotgan-store',
  statusReason: '통신판매업 신고증 사본이 흐려 확인이 어렵습니다', submittedAt: '2026-10-22T14:05:11+09:00', statusChangedAt: '2026-10-23T10:00:00+09:00',
  supplementDueAt: '2026-10-30T10:00:00+09:00', reapplyAvailableAt: null, storeId: null, requestedDocs: ['ECOMMERCE_REG'],
  history: [
    { fromStatus: null, toStatus: 'PENDING', actor: 'APPLICANT', reason: null, changedAt: '2026-10-22T14:05:11+09:00' },
    { fromStatus: 'PENDING', toStatus: 'SUPPLEMENT', actor: 'ADMIN', reason: '통신판매업 신고증 사본이 흐려 확인이 어렵습니다', changedAt: '2026-10-23T10:00:00+09:00' },
  ],
};

const file = (name, type, size = 1000) => new File([new Uint8Array(size)], name, { type });

describe('fetchMyApplication — GET /api/seller/apply/me', () => {
  it('신청한 적 없으면 null, 있으면 시각은 Date · 빈 사유 · 요청 서류는 배열', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValueOnce({ data: { data: null } }).mockResolvedValueOnce({ data: { data: ME } });

    expect(await fetchMyApplication()).toBeNull();
    const me = await fetchMyApplication();

    expect(get).toHaveBeenCalledWith('/api/seller/apply/me');
    expect(me).toMatchObject({ applicationId: 27, applicationNo: 'AP-2610-027', status: 'SUPPLEMENT', requestedDocs: ['ECOMMERCE_REG'] });
    expect(me.submittedAt).toEqual(new Date('2026-10-22T05:05:11Z'));
    expect(me.supplementDueAt).toEqual(new Date('2026-10-30T01:00:00Z'));
    expect(me.reapplyAvailableAt).toBeNull();
    expect(me.history[0]).toMatchObject({ toStatus: 'PENDING', actor: 'APPLICANT', reason: '' });
    expect(me.history[1].changedAt).toEqual(new Date('2026-10-23T01:00:00Z'));
  });

  it('옛 보완요청(requestedDocs null) · 사유 null 은 빈 값으로', () => {
    expect(toMyApplication({ ...ME, status: 'PENDING', statusReason: null, requestedDocs: null, history: null }))
      .toMatchObject({ statusReason: '', requestedDocs: [], history: [] });
  });
});

describe('uploadApplyDocuments — presign → S3 PUT → documents[]', () => {
  it('발급 순서대로 PUT(Content-Type 은 파일 형식) 하고 { docType, key, originalName } 을 돌려준다', async () => {
    const docs = [
      { docType: 'BUSINESS_REG', file: file('사업자등록증.pdf', 'application/pdf', 482113) },
      { docType: 'PRODUCT_PHOTO', file: file('상품1.jpg', 'image/jpeg', 834512) },
    ];
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [
      { key: 'applications/4/aaa.pdf', uploadUrl: 'https://s3/aaa', expiresAt: '2026-10-26T15:10:00+09:00' },
      { key: 'applications/4/bbb.jpg', uploadUrl: 'https://s3/bbb', expiresAt: '2026-10-26T15:10:00+09:00' },
    ] } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const documents = await uploadApplyDocuments(docs);

    expect(post).toHaveBeenCalledWith('/api/seller/apply/documents/presign', { files: [
      { docType: 'BUSINESS_REG', contentType: 'application/pdf', size: 482113 },
      { docType: 'PRODUCT_PHOTO', contentType: 'image/jpeg', size: 834512 },
    ] });
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://s3/aaa', { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: docs[0].file });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://s3/bbb', { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: docs[1].file });
    expect(documents).toEqual([
      { docType: 'BUSINESS_REG', key: 'applications/4/aaa.pdf', originalName: '사업자등록증.pdf' },
      { docType: 'PRODUCT_PHOTO', key: 'applications/4/bbb.jpg', originalName: '상품1.jpg' },
    ]);
    vi.unstubAllGlobals();
  });

  it('S3 가 거절(403)하면 오류 — 서류 없으면 발급도 안 함', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [{ key: 'k', uploadUrl: 'https://s3/k' }] } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(uploadApplyDocuments([{ docType: 'BANK_COPY', file: file('통장.jpg', 'image/jpeg') }])).rejects.toThrow('서류를 올리지 못했어요');
    expect(await uploadApplyDocuments([])).toEqual([]);
    expect(post).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('applySeller — 서류 올린 뒤 POST /api/seller/apply', () => {
  it('docs 는 documents[] 로 바꿔 보내고 접수 응답을 돌려준다', async () => {
    const post = vi.spyOn(axiosInstance, 'post')
      .mockResolvedValueOnce({ data: { data: [{ key: 'applications/4/a.pdf', uploadUrl: 'https://s3/a' }] } })
      .mockResolvedValueOnce({ data: { data: { applicationId: 27, applicationNo: 'AP-2610-027', status: 'PENDING', submittedAt: '2026-10-22T14:05:11+09:00' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const result = await applySeller({ storeName: '곳간상회', slug: 'gotgan-store', categoryId: 1,
      docs: [{ docType: 'BUSINESS_REG', file: file('a.pdf', 'application/pdf') }] });

    expect(post).toHaveBeenLastCalledWith('/api/seller/apply', { storeName: '곳간상회', slug: 'gotgan-store', categoryId: 1,
      documents: [{ docType: 'BUSINESS_REG', key: 'applications/4/a.pdf', originalName: 'a.pdf' }] });
    expect(result).toMatchObject({ applicationId: 27, status: 'PENDING' });
    vi.unstubAllGlobals();
  });
});

describe('submitted · resubmitApplication — 보완 재제출 (2-2 · 2-3절)', () => {
  it('submitted 의 서류 올린 시각은 Date, submitted 가 없으면 null', () => {
    const me = toMyApplication({ ...ME, submitted: { companyName: '곳간상회', documents: [{ docType: 'ECOMMERCE_REG', originalName: 'old.pdf', uploadedAt: '2026-10-22T14:05:11+09:00' }] } });
    expect(me.submitted.companyName).toBe('곳간상회');
    expect(me.submitted.documents[0].uploadedAt).toEqual(new Date('2026-10-22T05:05:11Z'));
    expect(toMyApplication(ME).submitted).toBeNull();
  });

  it('다시 낸 서류가 있으면 올린 뒤 documents 를 붙여 PATCH, 없으면 바뀐 항목만', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: [{ key: 'applications/5/n.pdf', uploadUrl: 'https://s3/n' }] } });
    const patch = vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { data: { applicationId: 102, status: 'PENDING' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const result = await resubmitApplication({ applicationId: 102, request: { companyName: '곳간상회2' },
      docs: [{ docType: 'ECOMMERCE_REG', file: file('new.pdf', 'application/pdf') }] });
    await resubmitApplication({ applicationId: 102, request: {}, docs: [] });

    expect(patch).toHaveBeenNthCalledWith(1, '/api/seller/apply/102/resubmit', { companyName: '곳간상회2',
      documents: [{ docType: 'ECOMMERCE_REG', key: 'applications/5/n.pdf', originalName: 'new.pdf' }] });
    expect(patch).toHaveBeenNthCalledWith(2, '/api/seller/apply/102/resubmit', {});
    expect(post).toHaveBeenCalledTimes(1); // 서류 없으면 presign 도 안 함
    expect(result).toMatchObject({ status: 'PENDING' });
    vi.unstubAllGlobals();
  });
});
