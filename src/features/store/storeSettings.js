// 판매자 스토어 설정 규칙 — 담당 박지연. 화면 입력값 ↔ 수정 요청(backend store.md 13-2절)

// 화면이 고르게 하는 대표 색 6개 — 서버는 #RRGGBB 형식만 본다(시드 색이 팔레트 밖이라). 지금 색이 밖이면 맨 앞에 함께 보여 준다
export const PALETTE = ['#5b6b4a', '#2b2b2b', '#7a4b2a', '#2f5f8a', '#b4371f', '#c08a2e'];
export const paletteWith = (color) => (PALETTE.includes(color) ? PALETTE : [color, ...PALETTE]);

export const COURIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'];
export const couriersWith = (courier) => (!courier || COURIERS.includes(courier) ? COURIERS : [courier, ...COURIERS]);

// toMyStore 결과 → 폼 값. 숫자 칸은 입력 중 빈칸을 허용하려고 문자열, 무료배송 없음(0)은 빈칸
export const initialSettings = (s) => ({
  intro: s.intro,
  imageKey: s.imageKey,
  cover: s.cover,
  color: s.color,
  csPhone: s.phone,
  shippingFee: String(s.shipFee),
  freeOver: s.freeOver ? String(s.freeOver) : '',
  courier: s.courier,
  dispatchNote: s.dispatch,
});

const PHONE = /^0\d{1,2}-\d{3,4}-\d{4}$/; // 휴대 · 지역 · 070

// 화면 검사 — 서버가 같은 규칙으로 다시 검사한다(13-2). 첫 번째 문제만 문구로
export function validateSettings(f) {
  if (!PHONE.test(f.csPhone.trim())) return '고객센터 전화번호를 010-0000-0000 형식으로 입력해 주세요';
  if (f.shippingFee === '' || Number(f.shippingFee) > 100000) return '기본 배송비는 0 ~ 100,000원이에요';
  if (f.freeOver !== '' && (Number(f.freeOver) < 1 || Number(f.freeOver) > 10000000)) return '무료배송 기준금액은 1 ~ 10,000,000원이에요 (없으면 비워 두세요)';
  if (f.intro.length > 5000) return '소개는 5,000자까지 쓸 수 있어요';
  if (f.courier.trim().length > 30) return '택배사는 30자까지예요';
  if (f.dispatchNote.trim().length > 100) return '출고 안내 문구는 100자까지예요';
  return null;
}

const orNull = (v) => v.trim() || null;

// 폼 → 13-2 요청 (설정 전체)
export const buildSettingsRequest = (f) => ({
  intro: orNull(f.intro),
  imageKey: f.imageKey,
  color: f.color,
  csPhone: f.csPhone.trim(),
  shippingFee: Number(f.shippingFee),
  freeShippingThreshold: f.freeOver === '' ? null : Number(f.freeOver),
  courier: orNull(f.courier),
  dispatchNote: orNull(f.dispatchNote),
});
