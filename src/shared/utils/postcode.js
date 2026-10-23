// 우편번호 검색 — 카카오(구 Daum) 우편번호 서비스. 키 · 사용량 제한 없음, 상업 이용 무료 (https://postcode.map.kakao.com/guide)
// 배송지(user) · 주문서 직접 입력(order) · 입점 신청 사업장 주소(store) 에서 같이 쓴다
export const POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

// 생성자 — 2025 개편 후 kakao.Postcode, 이전 이름 daum.Postcode 도 대비
export const postcodeConstructor = () => window.kakao?.Postcode ?? window.daum?.Postcode ?? null;

let loading = null;

/** 스크립트를 한 번만 불러온다 (이미 있으면 바로). 불러오는 중에 또 부르면 같은 대기열, 실패하면 다음 호출에서 다시 시도 */
export function loadPostcode() {
  if (postcodeConstructor()) return Promise.resolve(postcodeConstructor());
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = POSTCODE_SCRIPT_URL;
      script.async = true;
      script.onload = () => (postcodeConstructor() ? resolve(postcodeConstructor()) : reject(new Error('postcode unavailable')));
      script.onerror = () => reject(new Error('postcode script failed'));
      document.head.appendChild(script);
    }).finally(() => {
      loading = null; // 끝나면 비운다 — 성공 뒤에는 위 첫 줄이 바로 돌려줌
    });
  }
  return loading;
}

/**
 * 검색 결과 → { zip, addr } — 가이드 샘플과 같은 규칙:
 * 사용자가 고른 종류(R 도로명 · J 지번) 주소, 도로명이면 참고항목(법정동 · 공동주택 건물명)을 괄호로 덧붙인다
 */
export function toPostcodeAddress(data) {
  const road = data.userSelectedType !== 'J';
  const base = road ? (data.roadAddress || data.autoRoadAddress) : (data.jibunAddress || data.autoJibunAddress);
  const extras = [];
  if (road) {
    if (data.bname && /[동로가]$/.test(data.bname)) extras.push(data.bname);
    if (data.buildingName && data.apartment === 'Y') extras.push(data.buildingName);
  }
  return { zip: data.zonecode, addr: extras.length ? `${base} (${extras.join(', ')})` : base };
}
