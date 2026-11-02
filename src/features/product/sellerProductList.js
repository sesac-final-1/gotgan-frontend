// 판매자 상품 목록 규칙 — 담당 박지연

// 일괄 처리 결과 토스트 — 건마다 결과가 온다(product.md 15 · 16절). 재고 0 상품은 재개해도 품절로 보여(15절) 따로 알린다
// soldOutIds: 이번에 판매재개한 상품 중 재고가 0인 것
export function bulkResultMessage({ verb, success, failed, soldOutIds = [] }) {
  const soldOut = success.filter((id) => soldOutIds.includes(id)).length;
  const head = failed.length
    ? `${success.length}개 ${verb} · ${failed.length}개 실패 — ${failed[0].message}`
    : soldOut > 0 && soldOut === success.length ? verb : `${success.length}개 상품을 ${verb}`;
  if (!soldOut) return head;
  return soldOut === success.length
    ? `${head}. 재고가 0이라 품절로 보여요 — 「재고」에서 채워 주세요`
    : `${head}. 그중 ${soldOut}개는 재고가 0이라 품절로 보여요`;
}
