import { bulkResultMessage } from '@/features/product/sellerProductList';

describe('bulkResultMessage — 일괄 처리 토스트', () => {
  it('모두 성공 · 일부 실패(첫 사유)', () => {
    expect(bulkResultMessage({ verb: '판매중지했어요', success: [3, 4], failed: [] })).toBe('2개 상품을 판매중지했어요');
    expect(bulkResultMessage({ verb: '판매재개했어요', success: [3], failed: [{ productId: 7, message: '관리자가 판매중지한 상품은 재개할 수 없습니다.' }] }))
      .toBe('1개 판매재개했어요 · 1개 실패 — 관리자가 판매중지한 상품은 재개할 수 없습니다.');
  });

  it('재고 0 상품을 재개하면 품절로 보인다고 덧붙임 — 실패한 상품은 세지 않음', () => {
    expect(bulkResultMessage({ verb: '판매재개했어요', success: [3, 4], failed: [], soldOutIds: [4] }))
      .toBe('2개 상품을 판매재개했어요 · 1개는 재고가 0이라 품절로 보여요. 「재고」에서 채워 주세요');
    expect(bulkResultMessage({ verb: '판매재개했어요', success: [3], failed: [{ productId: 4, message: 'x' }], soldOutIds: [4] }))
      .toBe('1개 판매재개했어요 · 1개 실패 — x');
  });
});
