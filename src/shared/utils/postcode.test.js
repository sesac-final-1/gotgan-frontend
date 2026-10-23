import { loadPostcode, POSTCODE_SCRIPT_URL, postcodeConstructor, toPostcodeAddress } from '@/shared/utils/postcode';

afterEach(() => {
  delete window.kakao;
  delete window.daum;
  document.head.querySelectorAll('script[src*="postcode"]').forEach((s) => s.remove());
});

const result = (patch) => ({
  zonecode: '06236', userSelectedType: 'R', roadAddress: '서울 강남구 테헤란로 152', jibunAddress: '서울 강남구 역삼동 737',
  autoRoadAddress: '', autoJibunAddress: '', bname: '역삼동', buildingName: '강남파이낸스센터', apartment: 'N', ...patch,
});

describe('toPostcodeAddress — 가이드 샘플과 같은 주소 규칙', () => {
  it('도로명 선택 — 도로명 주소 + 법정동 참고항목', () => {
    expect(toPostcodeAddress(result())).toEqual({ zip: '06236', addr: '서울 강남구 테헤란로 152 (역삼동)' });
  });

  it('공동주택이면 건물명도 참고항목에, 법정동이 동 · 로 · 가로 끝나지 않으면 빼기', () => {
    expect(toPostcodeAddress(result({ apartment: 'Y', buildingName: '래미안', bname: '역삼동' })).addr).toBe('서울 강남구 테헤란로 152 (역삼동, 래미안)');
    expect(toPostcodeAddress(result({ bname: '가산리' })).addr).toBe('서울 강남구 테헤란로 152');
  });

  it('지번 선택 — 지번 주소, 참고항목 없음 · 비어 있으면 자동 매핑 주소', () => {
    expect(toPostcodeAddress(result({ userSelectedType: 'J' })).addr).toBe('서울 강남구 역삼동 737');
    expect(toPostcodeAddress(result({ userSelectedType: 'J', jibunAddress: '', autoJibunAddress: '서울 강남구 역삼동 737-1' })).addr)
      .toBe('서울 강남구 역삼동 737-1');
  });
});

describe('loadPostcode', () => {
  it('이미 있으면 스크립트를 넣지 않고, 이전 이름(daum)도 받는다', async () => {
    window.daum = { Postcode: class {} };
    await expect(loadPostcode()).resolves.toBe(window.daum.Postcode);
    expect(document.head.querySelector('script[src*="postcode"]')).toBeNull();
  });

  it('없으면 공식 스크립트를 한 번만 넣고, 불러오면 kakao.Postcode', async () => {
    const first = loadPostcode();
    const second = loadPostcode();
    const scripts = document.head.querySelectorAll('script[src*="postcode"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(POSTCODE_SCRIPT_URL);
    window.kakao = { Postcode: class {} };
    scripts[0].onload();
    await expect(first).resolves.toBe(window.kakao.Postcode);
    await expect(second).resolves.toBe(postcodeConstructor());
  });

  it('스크립트 실패 → 거절, 다음 호출에서 다시 시도', async () => {
    const failed = loadPostcode();
    document.head.querySelector('script[src*="postcode"]').onerror();
    await expect(failed).rejects.toThrow('postcode script failed');
    loadPostcode().catch(() => {});
    expect(document.head.querySelectorAll('script[src*="postcode"]')).toHaveLength(2);
  });
});
