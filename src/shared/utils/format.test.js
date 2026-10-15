import { won, comma, shortWon, salePrice, maskName, ymd, cx } from '@/shared/utils/format';

describe('format', () => {
  it('금액 표기', () => {
    expect(won(12900)).toBe('12,900원');
    expect(comma(1234567)).toBe('1,234,567');
    expect(shortWon(123_000_000)).toBe('1.2억');
    expect(shortWon(45_000)).toBe('5만'); // 만 단위는 정수 반올림
  });

  it('할인가는 10원 단위 반올림', () => {
    expect(salePrice({ price: 39000, discount: 0.15 })).toBe(33150);
    expect(salePrice({ price: 10000 })).toBe(10000);
  });

  it('이름 마스킹', () => {
    expect(maskName('김서연')).toBe('김*연');
    expect(maskName('이도')).toBe('이*');
  });

  it('날짜 · 클래스', () => {
    expect(ymd(new Date(2026, 9, 1))).toBe('2026.10.01');
    const hidden = false;
    expect(cx('a', hidden && 'b', 'c')).toBe('a c');
  });
});
