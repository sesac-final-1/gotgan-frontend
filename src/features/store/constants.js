// 입점 신청 화면 표시값 — 담당 박지연 (backend docs/api/store.md 2 · 2-2절 enum). admin/constants 에 같은 라벨이 있지만 store 는 admin 을 참조하지 않는다
export const APPLICATION_STATUS_LABEL = { PENDING: '심사대기', SUPPLEMENT: '보완요청', APPROVED: '승인', REJECTED: '반려' };

export const BIZ_TYPES = [{ value: 'INDIVIDUAL', label: '개인사업자' }, { value: 'CORPORATE', label: '법인사업자' }];

// 서류 4종 — 앞 3종은 1개씩(PDF · JPG · PNG), 상품 사진은 3~10장(JPG · PNG). 10MB 이하
export const DOC_TYPES = [
  { value: 'BUSINESS_REG', label: '사업자등록증', desc: '사업자등록증 사본', accept: 'application/pdf,image/jpeg,image/png' },
  { value: 'ECOMMERCE_REG', label: '통신판매업 신고증', desc: '정부24에서 발급 가능', accept: 'application/pdf,image/jpeg,image/png' },
  { value: 'BANK_COPY', label: '정산 계좌 통장 사본', desc: '사업자 명의 계좌 (개인사업자는 대표자 명의 가능)', accept: 'application/pdf,image/jpeg,image/png' },
  { value: 'PRODUCT_PHOTO', label: '대표 상품 사진', desc: '실제 판매할 상품 사진 3~10장', accept: 'image/jpeg,image/png', multiple: true },
];
export const DOC_TYPE_LABEL = Object.fromEntries(DOC_TYPES.map((d) => [d.value, d.label]));
export const PRODUCT_PHOTO_MIN = 3;
export const PRODUCT_PHOTO_MAX = 10;

export const EXPECTED_SALES = [
  { value: '', label: '선택 안 함' },
  { value: 'UNDER_5M', label: '500만원 미만' },
  { value: 'FROM_5M_TO_20M', label: '500만 ~ 2,000만원' },
  { value: 'FROM_20M_TO_100M', label: '2,000만 ~ 1억' },
  { value: 'OVER_100M', label: '1억 이상' },
];

export const BANKS = ['기업은행', '국민은행', '신한은행', '우리은행', '하나은행', '농협'];
