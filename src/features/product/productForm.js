// 판매자 상품 폼 규칙 — 담당 박지연. 화면 입력값 ↔ 등록 · 수정 요청(backend product.md 13절)
// 옵션 그룹 0~2개, 조합은 그룹 값의 곱. 그룹이 없으면 값이 null 인 조합 1개(옵션 없는 상품)

export const MAX_OPTION_GROUPS = 2;
export const MAX_IMAGES = 5;

// 조합 하나를 가리키는 키 — 그룹 값이 같으면 같은 조합(그룹 이름을 바꿔도 기존 옵션 id 유지)
export const comboKey = (values) => values.join('\u0000');

const splitValues = (text) => [...new Set(text.split(',').map((v) => v.trim()).filter(Boolean))];

// 이름 · 값이 모두 있는 그룹만
export const activeGroups = (groups) => groups
  .map((g) => ({ name: g.name.trim(), values: splitValues(g.values) }))
  .filter((g) => g.name && g.values.length);

// [{ name, values[] }] → [[값, 값], …]. 그룹이 없으면 [[]] (옵션 없는 상품 1행)
export const combos = (groups) => activeGroups(groups).reduce((acc, g) => acc.flatMap((a) => g.values.map((v) => [...a, v])), [[]]);

// 12절 상세 → 폼 초기값. 새 상품은 빈 폼(그룹 1개 비워 둠)
export function initialForm(src, categories) {
  if (!src) {
    const top = categories[0];
    return {
      cat: top?.id, catId: top?.children[0]?.id, name: '', price: 0, discountRate: 0, description: '', material: '', origin: '',
      groups: [{ name: '', values: '' }], rows: {}, images: [], status: '판매중',
    };
  }
  const names = [src.option1Name, src.option2Name].filter(Boolean);
  const valuesOf = (k) => [...new Set(src.options.map((o) => o[k]).filter((v) => v != null))];
  return {
    cat: src.cat, catId: src.catId, name: src.name, price: src.price, discountRate: src.discountRate,
    description: src.description, material: src.material, origin: src.origin,
    groups: names.map((name, i) => ({ name, values: valuesOf(i === 0 ? 'option1Value' : 'option2Value').join(', ') })),
    rows: Object.fromEntries(src.options.map((o) => [
      comboKey([o.option1Value, o.option2Value].filter((v) => v != null)),
      { productOptionId: o.productOptionId, extraPrice: o.extraPrice, stock: o.stock, on: true },
    ])),
    images: src.images,
    status: src.status,
  };
}

// 조합표 한 줄 — 입력한 적 없는 조합은 새 조합(추가금 0 · 재고 0 · 판매)
export const rowOf = (rows, values) => rows[comboKey(values)] ?? { productOptionId: null, extraPrice: 0, stock: 0, on: true };

// 화면 검사 — 서버가 같은 규칙으로 다시 검사한다(13절). 첫 번째 문제만 문구로
export function validateForm(f) {
  const opts = combos(f.groups).filter((v) => rowOf(f.rows, v).on);
  if (!f.catId) return '하위 카테고리를 골라 주세요';
  if (!f.name.trim()) return '상품명을 입력해 주세요';
  if (!(f.price >= 100)) return '판매가는 100원 이상이어야 해요';
  if (activeGroups(f.groups).length !== f.groups.filter((g) => g.name.trim() || g.values.trim()).length) return '옵션명과 옵션값을 함께 입력해 주세요';
  if (new Set(activeGroups(f.groups).map((g) => g.name)).size < activeGroups(f.groups).length) return '옵션명이 서로 달라야 해요';
  if (opts.length === 0) return '판매할 옵션 조합을 하나 이상 골라 주세요';
  if (opts.length > 100) return '옵션 조합은 100개까지 만들 수 있어요';
  if (f.images.length === 0) return '상품 이미지를 한 장 이상 올려 주세요';
  if (!f.material.trim() || !f.origin.trim()) return '소재와 제조국을 입력해 주세요';
  return null;
}

// 폼 → 13절 요청. 수정이면 status 는 서버가 무시하지만 같은 모양으로 보낸다
export function buildProductRequest(f) {
  const groups = activeGroups(f.groups);
  return {
    categoryId: f.catId,
    name: f.name.trim(),
    price: f.price,
    discountRate: f.discountRate,
    description: f.description,
    material: f.material.trim(),
    origin: f.origin.trim(),
    option1Name: groups[0]?.name ?? null,
    option2Name: groups[1]?.name ?? null,
    options: combos(f.groups).map((values) => ({ values, row: rowOf(f.rows, values) })).filter(({ row }) => row.on).map(({ values, row }) => ({
      productOptionId: row.productOptionId,
      option1Value: values[0] ?? null,
      option2Value: values[1] ?? null,
      extraPrice: row.extraPrice,
      stock: row.stock,
    })),
    imageKeys: f.images.map((img) => img.key),
    status: f.status === '판매중지' ? 'STOPPED' : 'ON_SALE',
  };
}
