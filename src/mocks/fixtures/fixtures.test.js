// 목업 데이터가 깨지지 않고 불러와지는지 — 상수 이동 · 경로 수정 후 회귀 방지
import { categories, stores, products } from '@/mocks/fixtures/catalog';
import { myOrders, sellerOrders, settlements } from '@/mocks/fixtures/orders';
import { users, applications } from '@/mocks/fixtures/people';
import { myPointHistory, myPointBalance } from '@/mocks/fixtures/points';
import { reviews, qnas } from '@/mocks/fixtures/reviews';
import { orderPay } from '@/mocks/fixtures/orders';

describe('목업 데이터', () => {
  it('컬렉션이 비어 있지 않다', () => {
    for (const list of [categories, stores, products, myOrders, sellerOrders, settlements, users, applications, myPointHistory, reviews, qnas]) {
      expect(list.length).toBeGreaterThan(0);
    }
    expect(typeof myPointBalance).toBe('number');
  });

  it('주문 결제 금액 = 상품 + 배송비 - 포인트', () => {
    const o = myOrders[0];
    const p = orderPay(o);
    expect(p.paid).toBe(p.goods + p.ship - p.used);
  });
});
