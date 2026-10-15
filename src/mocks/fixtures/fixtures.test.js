// 목업 데이터가 깨지지 않고 불러와지는지 — 상수 이동 · 경로 수정 후 회귀 방지
import { categories, stores, products } from '@/mocks/fixtures/catalog';
import { myOrders, sellerOrders, settlements } from '@/mocks/fixtures/orders';
import { users, applications } from '@/mocks/fixtures/people';
import { myPointHistory, myPointBalance } from '@/mocks/fixtures/points';
import { reviews, qnas } from '@/mocks/fixtures/reviews';
import { applicationHistory, historyOf } from '@/mocks/fixtures/applicationHistory';
import { orderPay } from '@/features/order/utils/orderCalc';

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

  it('입점 이력: 신청마다 접수 이벤트가 있고 최신순 정렬', () => {
    expect(applicationHistory.filter((h) => h.from === null)).toHaveLength(applications.length);
    for (let i = 1; i < applicationHistory.length; i++) expect(applicationHistory[i - 1].at >= applicationHistory[i].at).toBe(true);
    const t = historyOf('AP-2609-025');
    expect(t.at(-1).to).toBe('승인');
  });
});
