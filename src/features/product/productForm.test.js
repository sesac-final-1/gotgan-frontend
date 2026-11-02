import { combos, activeGroups, initialForm, rowOf, comboKey, validateForm, buildProductRequest, allStockZero } from '@/features/product/productForm';

const CATEGORIES = [{ id: 1, name: '식품', children: [{ id: 101, name: '과일' }, { id: 102, name: '꿀' }] }, { id: 3, name: '패션', children: [{ id: 301, name: '셔츠' }] }];

// toSellerProductDetail 결과 모양 (product.md 12절을 화면 이름으로)
const SRC = {
  id: 3, cat: 3, catId: 301, name: '리넨 셔츠', price: 89000, discountRate: 15, description: '<p>리넨</p>', material: '리넨 100%', origin: '대한민국',
  option1Name: '컬러', option2Name: '사이즈',
  options: [
    { productOptionId: 11, option1Value: '오트밀', option2Value: 'M', extraPrice: 0, stock: 30 },
    { productOptionId: 12, option1Value: '오트밀', option2Value: 'L', extraPrice: 2000, stock: 0 },
  ],
  images: [{ key: 'products/1/a.jpg', url: 'https://img/products/1/a.jpg' }],
  status: '판매중', pill: '판매중', statusReason: '',
};

const valid = (patch = {}) => ({
  ...initialForm(null, CATEGORIES), name: '햇감귤', price: 32900, material: '감귤', origin: '대한민국',
  groups: [], images: [{ key: 'products/1/b.jpg', url: 'blob:b' }], ...patch,
});

describe('옵션 조합', () => {
  it('그룹 값의 곱 · 공백 · 중복 · 빈 값 정리, 이름이나 값이 비면 그룹이 아님', () => {
    const groups = [{ name: ' 컬러 ', values: '오트밀, 화이트,, 오트밀' }, { name: '사이즈', values: 'M,L' }, { name: '', values: 'X' }];

    expect(activeGroups(groups)).toEqual([{ name: '컬러', values: ['오트밀', '화이트'] }, { name: '사이즈', values: ['M', 'L'] }]);
    expect(combos(groups)).toEqual([['오트밀', 'M'], ['오트밀', 'L'], ['화이트', 'M'], ['화이트', 'L']]);
  });

  it('그룹이 없으면 옵션 없는 상품 1행([])', () => {
    expect(combos([])).toEqual([[]]);
    expect(combos([{ name: '컬러', values: '' }])).toEqual([[]]);
  });
});

describe('initialForm', () => {
  it('새 상품 — 첫 상위 카테고리 · 첫 하위, 빈 그룹 1개 · 판매중', () => {
    expect(initialForm(null, CATEGORIES)).toMatchObject({ cat: 1, catId: 101, name: '', groups: [{ name: '', values: '' }], rows: {}, images: [], status: '판매중' });
  });

  it('수정 — 옵션 이름 · 값으로 그룹을 되살리고, 조합마다 옵션 id · 추가금 · 재고', () => {
    const f = initialForm(SRC, CATEGORIES);

    expect(f.groups).toEqual([{ name: '컬러', values: '오트밀' }, { name: '사이즈', values: 'M, L' }]);
    expect(rowOf(f.rows, ['오트밀', 'L'])).toEqual({ productOptionId: 12, extraPrice: 2000, stock: 0, on: true });
    expect(rowOf(f.rows, ['화이트', 'M'])).toEqual({ productOptionId: null, extraPrice: 0, stock: 0, on: true }); // 새 조합
  });

  it('옵션 없는 상품(값 null 1개) — 그룹 없음 · 빈 키 행', () => {
    const f = initialForm({ ...SRC, option1Name: null, option2Name: null, options: [{ productOptionId: 20, option1Value: null, option2Value: null, extraPrice: 0, stock: 5 }] }, CATEGORIES);

    expect(f.groups).toEqual([]);
    expect(f.rows[comboKey([])]).toMatchObject({ productOptionId: 20, stock: 5 });
  });
});

describe('validateForm', () => {
  it('통과하면 null', () => {
    expect(validateForm(valid())).toBeNull();
  });

  it.each([
    [{ catId: undefined }, '하위 카테고리를 골라 주세요'],
    [{ name: '  ' }, '상품명을 입력해 주세요'],
    [{ price: 99 }, '판매가는 100원 이상이어야 해요'],
    [{ groups: [{ name: '컬러', values: '' }] }, '옵션명과 옵션값을 함께 입력해 주세요'],
    [{ groups: [{ name: '컬러', values: 'A' }, { name: '컬러', values: 'B' }] }, '옵션명이 서로 달라야 해요'],
    [{ rows: { [comboKey([])]: { productOptionId: null, extraPrice: 0, stock: 0, on: false } } }, '판매할 옵션 조합을 하나 이상 골라 주세요'],
    [{ groups: [{ name: 'A', values: Array.from({ length: 11 }, (_, i) => i).join(',') }, { name: 'B', values: Array.from({ length: 10 }, (_, i) => i).join(',') }] }, '옵션 조합은 100개까지 만들 수 있어요'],
    [{ images: [] }, '상품 이미지를 한 장 이상 올려 주세요'],
    [{ origin: '' }, '소재와 제조국을 입력해 주세요'],
  ])('%o → %s', (patch, message) => {
    expect(validateForm(valid(patch))).toBe(message);
  });
});

describe('buildProductRequest — 13절 요청', () => {
  it('수정 — 기존 조합은 옵션 id, 새 조합은 null, 판매 체크를 푼 조합은 빠짐 · 이미지는 key 순서대로', () => {
    const f = initialForm(SRC, CATEGORIES);
    f.groups = [{ name: '컬러', values: '오트밀, 화이트' }, { name: '사이즈', values: 'M, L' }];
    f.rows[comboKey(['오트밀', 'L'])].on = false;
    f.rows[comboKey(['화이트', 'M'])] = { productOptionId: null, extraPrice: 1000, stock: 7, on: true };
    f.images = [{ key: 'products/1/c.jpg', url: 'blob:c' }, ...f.images];

    expect(buildProductRequest(f)).toEqual({
      categoryId: 301, name: '리넨 셔츠', price: 89000, discountRate: 15, description: '<p>리넨</p>', material: '리넨 100%', origin: '대한민국',
      option1Name: '컬러', option2Name: '사이즈',
      options: [
        { productOptionId: 11, option1Value: '오트밀', option2Value: 'M', extraPrice: 0, stock: 30 },
        { productOptionId: null, option1Value: '화이트', option2Value: 'M', extraPrice: 1000, stock: 7 },
        { productOptionId: null, option1Value: '화이트', option2Value: 'L', extraPrice: 0, stock: 0 },
      ],
      imageKeys: ['products/1/c.jpg', 'products/1/a.jpg'],
      status: 'ON_SALE',
    });
  });

  it('옵션 없는 새 상품 · 판매중지로 등록 — 값 null 옵션 1개 · STOPPED · 앞뒤 공백 제거', () => {
    const f = valid({ name: ' 햇감귤 ', status: '판매중지', rows: { [comboKey([])]: { productOptionId: null, extraPrice: 0, stock: 40, on: true } } });

    expect(buildProductRequest(f)).toMatchObject({
      categoryId: 101, name: '햇감귤', option1Name: null, option2Name: null,
      options: [{ productOptionId: null, option1Value: null, option2Value: null, extraPrice: 0, stock: 40 }],
      imageKeys: ['products/1/b.jpg'], status: 'STOPPED',
    });
  });
});

describe('allStockZero — 등록 전 품절 확인', () => {
  it('판매할 조합 재고가 모두 0이면 true, 하나라도 있으면 false · 판매 체크를 푼 조합은 보지 않음', () => {
    const groups = [{ name: '컬러', values: '빨강, 파랑' }];
    expect(allStockZero(valid({ groups }))).toBe(true); // 새 조합 기본값 0
    expect(allStockZero(valid({ groups, rows: { [comboKey(['파랑'])]: { productOptionId: null, extraPrice: 0, stock: 3, on: true } } }))).toBe(false);
    expect(allStockZero(valid({ groups, rows: { [comboKey(['파랑'])]: { productOptionId: null, extraPrice: 0, stock: 3, on: false } } }))).toBe(true);
  });
});
