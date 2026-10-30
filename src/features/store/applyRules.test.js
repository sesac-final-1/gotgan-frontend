import { formatProblem, toResubmitForm, buildResubmitRequest, requiredDocTypes, resubmitConfirmMessage } from '@/features/store/applyRules';

describe('formatProblem — 서버와 같은 형식 규칙', () => {
  it('틀린 첫 칸의 문구, 모두 맞으면 null', () => {
    const ok = { bizRegNo: '000-00-00001', managerPhone: '010-0000-1234', managerEmail: 'a@b.co', slug: 'gotgan-store' };
    expect(formatProblem(['bizRegNo', 'managerPhone', 'managerEmail', 'slug'], ok)).toBeNull();
    expect(formatProblem(['bizRegNo'], { bizRegNo: '1234567890' })).toBe('사업자등록번호는 000-00-00000 형식입니다.');
    expect(formatProblem(['managerPhone'], { managerPhone: '02-000-0000' })).toBe('휴대폰 번호는 010-0000-0000 형식입니다.');
    expect(formatProblem(['managerEmail'], { managerEmail: 'seller' })).toBe('이메일 형식이 올바르지 않습니다.');
    expect(formatProblem(['slug'], { slug: '-bad' })).toContain('영소문자 · 숫자 · 하이픈 3~30자');
    expect(formatProblem(['slug'], { slug: 'admin' })).toBe('사용할 수 없는 스토어 주소입니다.');
    expect(formatProblem(['companyName'], { companyName: '' })).toBeNull(); // 규칙 없는 칸은 통과(빈칸 검사는 따로)
  });
});

// store.md 2-2절 me — submitted 포함
const ME = {
  applicationId: 102, status: 'SUPPLEMENT', storeName: '곳간상회', slug: 'gotgan-store', requestedDocs: ['ECOMMERCE_REG'],
  submitted: {
    bizType: 'INDIVIDUAL', companyName: '곳간상회', ownerName: '홍길동', bizRegNo: '000-00-00001', ecommerceRegNo: '2026-서울성동-0000',
    managerPhone: '010-0000-1234', managerEmail: 'seller@example.com', businessAddress: '서울시 성동구', categoryId: 1, intro: '<p>소개</p>',
    representativeProducts: [{ name: '감귤', subCategory: '과일', price: 32900 }, { name: '꿀', subCategory: '과일', price: 48000 }],
    expectedMonthlySales: null, salesChannel: null, settlementAccount: { bank: '국민은행', number: '000000-00-000000', holder: '홍길동' },
    marketingAgreed: false, documents: [],
  },
};

describe('보완 재제출 — 바뀐 칸만', () => {
  it('처음 값은 제출한 내용 그대로(빈 값은 빈 문자열, 가격은 입력칸용 문자열)', () => {
    expect(toResubmitForm(ME)).toMatchObject({
      bizType: 'INDIVIDUAL', companyName: '곳간상회', storeName: '곳간상회', slug: 'gotgan-store', categoryId: 1, intro: '<p>소개</p>',
      expectedMonthlySales: '', salesChannel: '', bank: '국민은행', number: '000000-00-000000', holder: '홍길동',
      products: [{ name: '감귤', subCategory: '과일', price: '32900' }, { name: '꿀', subCategory: '과일', price: '48000' }],
    });
  });

  it('아무것도 안 바꾸면 빈 본문 {} — 서버는 "확인했다"로 접수', () => {
    expect(buildResubmitRequest(ME, toResubmitForm(ME))).toEqual({ request: {}, bizChanged: false });
  });

  it('바꾼 칸만 — 앞뒤 공백은 무시, 계좌는 세 값 모두, 대표 상품은 목록 전체, 소개만 빈칸으로 지울 수 있음', () => {
    const form = { ...toResubmitForm(ME), companyName: ' 곳간상회 ', storeName: '곳간상회2', number: '111-111', intro: '',
      expectedMonthlySales: 'UNDER_5M', salesChannel: '  ', products: [{ name: '감귤 5kg', subCategory: '과일', price: '32900' }, { name: '꿀', subCategory: '과일', price: '48000' }] };

    const { request, bizChanged } = buildResubmitRequest(ME, form);

    expect(request).toEqual({
      storeName: '곳간상회2', intro: '', expectedMonthlySales: 'UNDER_5M',
      representativeProducts: [{ name: '감귤 5kg', subCategory: '과일', price: 32900 }, { name: '꿀', subCategory: '과일', price: 48000 }],
      settlementAccount: { bank: '국민은행', number: '111-111', holder: '홍길동' },
    });
    expect(bizChanged).toBe(false);
  });

  it('사업자 구분 · 대표자 · 사업자번호 중 하나라도 바뀌면 bizChanged → 사업자등록증도 필수', () => {
    const changed = buildResubmitRequest(ME, { ...toResubmitForm(ME), bizRegNo: '000-00-00002' });
    expect(changed).toEqual({ request: { bizRegNo: '000-00-00002' }, bizChanged: true });
    expect(buildResubmitRequest(ME, { ...toResubmitForm(ME), bizType: 'CORPORATE' }).bizChanged).toBe(true);
    expect(buildResubmitRequest(ME, { ...toResubmitForm(ME), managerEmail: 'new@example.com' }).bizChanged).toBe(false);

    expect(requiredDocTypes(ME, false)).toEqual(['ECOMMERCE_REG']);
    expect(requiredDocTypes(ME, true)).toEqual(['ECOMMERCE_REG', 'BUSINESS_REG']);
    expect(requiredDocTypes({ ...ME, requestedDocs: ['BUSINESS_REG'] }, true)).toEqual(['BUSINESS_REG']); // 중복 없음
    expect(requiredDocTypes({ ...ME, requestedDocs: null }, false)).toEqual([]); // 옛 보완요청 · 내용 보완
  });
});

describe('resubmitConfirmMessage — 제출 전 확인 문구', () => {
  it('바꾼 칸 이름(화면 라벨) + 다시 낸 서류, 없으면 확인만', () => {
    expect(resubmitConfirmMessage({ companyName: 'x', settlementAccount: {} }, ['통신판매업 신고증']))
      .toBe('바꾼 항목: 상호명 · 정산 계좌 · 통신판매업 신고증(다시 냄)\n제출하면 다시 심사받습니다. 제출할까요?');
    expect(resubmitConfirmMessage({}, [])).toBe('바꾼 항목이 없어요. 확인만 제출할까요?');
  });
});
