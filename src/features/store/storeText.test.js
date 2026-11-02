import { shippingText } from '@/features/store/storeText';

describe('shippingText — 스토어 홈 배송 한 줄', () => {
  it.each([
    [{ courier: '우체국택배', shipFee: 3000, freeOver: 30000 }, '우체국택배 · 3,000원 (30,000원 이상 무료)'],
    [{ courier: '우체국택배', shipFee: 3000, freeOver: 0 }, '우체국택배 · 3,000원'], // 무료배송 기준 없음(null → 0)
    [{ courier: 'CJ대한통운', shipFee: 0, freeOver: 0 }, 'CJ대한통운 · 무료배송'],
    [{ courier: '', shipFee: 3000, freeOver: 0 }, '3,000원'], // 택배사 미정
  ])('%o → %s', (s, text) => {
    expect(shippingText(s)).toBe(text);
  });
});
