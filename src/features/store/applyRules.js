// 입점 신청 · 보완 재제출 공용 규칙 — 담당 박지연. 계약: backend docs/api/store.md 2절(입력 규칙) · 2-3절(재제출)

// 서버(SellerApplyRequest · ApplicationResubmitRequest)가 형식을 검사하는 네 칸 — 같은 규칙 · 문구로 화면에서 미리 막는다. 서버 규칙이 바뀌면 여기도 같이
const RESERVED_SLUGS = ['admin', 'seller', 'new', 'api', 'me'];
const FORMAT_RULES = {
  bizRegNo: [[/^\d{3}-\d{2}-\d{5}$/, '사업자등록번호는 000-00-00000 형식입니다.']],
  managerPhone: [[/^01[016789]-\d{3,4}-\d{4}$/, '휴대폰 번호는 010-0000-0000 형식입니다.']],
  managerEmail: [[/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '이메일 형식이 올바르지 않습니다.']],
  slug: [
    [/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/, '스토어 주소는 영소문자 · 숫자 · 하이픈 3~30자, 하이픈으로 시작 · 끝날 수 없습니다.'],
    [(v) => !RESERVED_SLUGS.includes(v), '사용할 수 없는 스토어 주소입니다.'],
  ],
};

/** fields 중 형식이 틀린 첫 칸의 안내 문구, 모두 맞으면 null */
export function formatProblem(fields, form) {
  for (const k of fields) {
    const v = String(form[k] ?? '').trim();
    const bad = (FORMAT_RULES[k] ?? []).find(([rule]) => (rule instanceof RegExp ? !rule.test(v) : !rule(v)));
    if (bad) return bad[1];
  }
  return null;
}

/* ─── 보완 재제출 (2-3절) ─── */

const TEXT_FIELDS = ['companyName', 'ownerName', 'bizRegNo', 'ecommerceRegNo', 'managerPhone', 'managerEmail', 'businessAddress'];
const BIZ_FIELDS = ['bizType', 'ownerName', 'bizRegNo']; // 하나라도 바뀌면 사업자등록증도 다시(서버 규칙)

const toProductRow = (p) => ({ name: p.name, subCategory: p.subCategory, price: String(p.price) });
const normalizeProducts = (rows) => rows.map((p) => ({ name: p.name.trim(), subCategory: p.subCategory, price: Number(p.price) }));

/** 재제출 폼의 처음 값 — me.submitted(제출한 내용) + 스토어명 · 주소. 고칠 수 없는 값(약관 · 마케팅)은 넣지 않는다 */
export function toResubmitForm(me) {
  const s = me.submitted;
  return {
    bizType: s.bizType,
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, s[k] ?? ''])),
    storeName: me.storeName ?? '',
    slug: me.slug ?? '',
    categoryId: s.categoryId,
    intro: s.intro ?? '',
    expectedMonthlySales: s.expectedMonthlySales ?? '',
    salesChannel: s.salesChannel ?? '',
    bank: s.settlementAccount?.bank ?? '',
    number: s.settlementAccount?.number ?? '',
    holder: s.settlementAccount?.holder ?? '',
    products: (s.representativeProducts ?? []).map(toProductRow),
  };
}

/**
 * 재제출 본문 — 지금 값과 다른 칸만 담는다(보내지 않은 칸은 서버가 그대로 둠).
 * 계좌는 하나라도 바뀌면 세 값 모두, 대표 상품은 바뀌면 목록 전체. 빈 문자열로 지울 수 없어(소개만 예외) 월 매출 · 판매 채널은 비우면 안 보낸다.
 * bizChanged = 사업자 구분 · 대표자 · 사업자번호 중 하나라도 바뀜 → 사업자등록증 필수
 */
export function buildResubmitRequest(me, form) {
  const start = toResubmitForm(me);
  const request = {};
  if (form.bizType !== start.bizType) request.bizType = form.bizType;
  for (const k of [...TEXT_FIELDS, 'storeName', 'slug']) {
    const v = form[k].trim();
    if (v !== start[k]) request[k] = v;
  }
  if (form.categoryId !== start.categoryId) request.categoryId = form.categoryId;
  if (form.intro.trim() !== start.intro) request.intro = form.intro.trim();
  if (form.expectedMonthlySales && form.expectedMonthlySales !== start.expectedMonthlySales) request.expectedMonthlySales = form.expectedMonthlySales;
  if (form.salesChannel.trim() && form.salesChannel.trim() !== start.salesChannel) request.salesChannel = form.salesChannel.trim();
  const products = normalizeProducts(form.products);
  if (JSON.stringify(products) !== JSON.stringify(normalizeProducts(start.products))) request.representativeProducts = products;
  if (['bank', 'number', 'holder'].some((k) => form[k].trim() !== start[k])) {
    request.settlementAccount = { bank: form.bank.trim(), number: form.number.trim(), holder: form.holder.trim() };
  }
  return { request, bizChanged: BIZ_FIELDS.some((k) => k in request) };
}

// 확인 창에 보여 줄 칸 이름 — 화면 라벨과 같게
const FIELD_LABEL = {
  bizType: '사업자 구분', companyName: '상호명', ownerName: '대표자명', bizRegNo: '사업자등록번호', ecommerceRegNo: '통신판매업 신고번호',
  managerPhone: '담당자 휴대폰', managerEmail: '담당자 이메일', businessAddress: '사업장 주소', storeName: '스토어 이름', slug: '스토어 주소',
  categoryId: '대표 카테고리', intro: '스토어 소개', representativeProducts: '판매 예정 상품', expectedMonthlySales: '월 예상 매출',
  salesChannel: '운영 중인 채널', settlementAccount: '정산 계좌',
};

/** 제출 전 확인 문구 — 바꾼 칸 이름 + 다시 낸 서류(docLabels). 실수로 건드린 칸을 제출 전에 알아차리게 */
export function resubmitConfirmMessage(request, docLabels) {
  const changed = [...Object.keys(request).map((k) => FIELD_LABEL[k] ?? k), ...docLabels.map((l) => `${l}(다시 냄)`)];
  return changed.length
    ? `바꾼 항목: ${changed.join(' · ')}\n제출하면 다시 심사받습니다. 제출할까요?`
    : '바꾼 항목이 없어요. 확인만 제출할까요?';
}

/** 다시 올려야 하는 서류 종류 — 보완요청 서류 전부 + 사업자 정보를 바꿨으면 사업자등록증 */
export const requiredDocTypes = (me, bizChanged) => [...new Set([...(me.requestedDocs ?? []), ...(bizChanged ? ['BUSINESS_REG'] : [])])];
