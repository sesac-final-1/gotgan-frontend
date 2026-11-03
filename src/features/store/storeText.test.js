import { shippingText, introToText, textToIntro } from '@/features/store/storeText';

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

describe('스토어 소개 — 저장된 HTML ↔ 입력 칸 글자', () => {
  it.each([
    ['<p>귤 농사</p>', '귤 농사'],
    ['<p>제주 서귀포에서</p><p>귤을 키웁니다</p>', '제주 서귀포에서\n귤을 키웁니다'],
    ['한 줄<br>두 줄<br/>세 줄', '한 줄\n두 줄\n세 줄'],
    ['<p><b>무농약</b> 귤 &amp; 한라봉</p>', '무농약 귤 & 한라봉'], // 서식 태그는 버리고 글자만
    ['신청 때 쓴 글자 그대로', '신청 때 쓴 글자 그대로'],
    [null, ''],
    ['', ''],
  ])('introToText(%o) → %o', (html, text) => {
    expect(introToText(html)).toBe(text);
  });

  it('textToIntro — 줄마다 문단, 빈 줄 · 앞뒤 공백은 버리고, 글자 속 < > & 는 이스케이프', () => {
    expect(textToIntro('제주 서귀포에서\n\n  귤을 키웁니다  ')).toBe('<p>제주 서귀포에서</p><p>귤을 키웁니다</p>');
    expect(textToIntro('1kg < 2kg & "특"')).toBe('<p>1kg &lt; 2kg &amp; &quot;특&quot;</p>');
    expect(textToIntro('  \n ')).toBeNull();
  });

  it('글자 → HTML → 글자로 되돌리면 같은 내용', () => {
    const text = '제주 서귀포에서\n<무농약> 귤 & 한라봉';
    expect(introToText(textToIntro(text))).toBe(text);
  });
});
