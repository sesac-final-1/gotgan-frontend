import { PALETTE, paletteWith, couriersWith, initialSettings, validateSettings, buildSettingsRequest } from '@/features/store/storeSettings';

// toMyStore 결과 모양 (store.md 13-1 을 화면 이름으로)
const STORE = { id: 1, name: '산골농부 박씨네', intro: '<p>귤 농사</p>', imageKey: null, cover: null, color: '#d0701f', phone: '064-0000-0006',
  shipFee: 3000, freeOver: 30000, courier: '우체국택배', dispatch: '수확일 기준 당일 발송' };

const valid = (patch = {}) => ({ ...initialSettings(STORE), ...patch });

describe('팔레트 · 택배사 목록', () => {
  it('지금 색 · 택배사가 목록 밖이면 맨 앞에 함께, 안이면 그대로', () => {
    expect(paletteWith('#d0701f')).toEqual(['#d0701f', ...PALETTE]);
    expect(paletteWith(PALETTE[2])).toBe(PALETTE);
    expect(couriersWith('경동택배')[0]).toBe('경동택배');
    expect(couriersWith('우체국택배')).not.toContain('');
    expect(couriersWith('')).toHaveLength(5);
  });
});

describe('initialSettings', () => {
  it('숫자는 문자열 칸으로, 무료배송 없음(0)은 빈칸', () => {
    expect(initialSettings(STORE)).toEqual({ intro: '<p>귤 농사</p>', imageKey: null, cover: null, color: '#d0701f', csPhone: '064-0000-0006',
      shippingFee: '3000', freeOver: '30000', courier: '우체국택배', dispatchNote: '수확일 기준 당일 발송' });
    expect(initialSettings({ ...STORE, freeOver: 0 }).freeOver).toBe('');
  });
});

describe('validateSettings', () => {
  it('통과하면 null · 070 · 휴대폰도 통과', () => {
    expect(validateSettings(valid())).toBeNull();
    expect(validateSettings(valid({ csPhone: '070-1234-5678' }))).toBeNull();
    expect(validateSettings(valid({ csPhone: '010-1234-5678', freeOver: '', shippingFee: '0' }))).toBeNull();
  });

  it.each([
    [{ csPhone: '01012345678' }, '고객센터 전화번호를 010-0000-0000 형식으로 입력해 주세요'],
    [{ shippingFee: '' }, '기본 배송비는 0 ~ 100,000원이에요'],
    [{ shippingFee: '100001' }, '기본 배송비는 0 ~ 100,000원이에요'],
    [{ freeOver: '0' }, '무료배송 기준금액은 1 ~ 10,000,000원이에요 (없으면 비워 두세요)'],
    [{ freeOver: '10000001' }, '무료배송 기준금액은 1 ~ 10,000,000원이에요 (없으면 비워 두세요)'],
    [{ intro: 'x'.repeat(5001) }, '소개는 5,000자까지 쓸 수 있어요'],
    [{ courier: 'x'.repeat(31) }, '택배사는 30자까지예요'],
    [{ dispatchNote: 'x'.repeat(101) }, '출고 안내 문구는 100자까지예요'],
  ])('%o → %s', (patch, message) => {
    expect(validateSettings(valid(patch))).toBe(message);
  });
});

describe('buildSettingsRequest — 13-2 요청', () => {
  it('숫자 변환 · 무료배송 빈칸은 null · 빈 문자열(공백뿐)은 null · 이미지 키 그대로', () => {
    expect(buildSettingsRequest(valid({ imageKey: 'stores/1/a.jpg', freeOver: '', courier: '', dispatchNote: '  ', intro: '', csPhone: ' 064-0000-0006 ' }))).toEqual({
      intro: null, imageKey: 'stores/1/a.jpg', color: '#d0701f', csPhone: '064-0000-0006', shippingFee: 3000, freeShippingThreshold: null, courier: null, dispatchNote: null,
    });
    expect(buildSettingsRequest(valid())).toMatchObject({ freeShippingThreshold: 30000, courier: '우체국택배', intro: '<p>귤 농사</p>' });
  });
});
