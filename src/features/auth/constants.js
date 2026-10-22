// 인증 상수 — 담당 이경석

// 소셜 로그인 제공자 — id 는 백엔드 /api/auth/social/{id} 의 alias. 모양은 각 개발자 사이트 가이드 그대로 (심볼 · 색 변경 금지)
// - kakao: 카카오디벨로퍼스 디자인 가이드 — 배경 #FEE500 · 레이블 검정 85% · 모서리 12px, 심볼은 리소스(login-complete-ko.svg)에서 추출
// - google: Google Sign-In 브랜딩 가이드(Light) — 흰 배경 · 테두리 #747775 · 글자 #1F1F1F, G 로고는 signin-assets.zip 에서 추출
// - naver: 네이버 개발자센터 로그인 버튼 리소스(NAVER_login_KR.zip) 의 Light · green · wide · H48 이미지 그대로 — 368×48, 로그인 화면 폭과 같음
//   (이미지 버튼이라 image 만 쓰고 레이블은 대체 텍스트로)
export const SOCIAL_PROVIDERS = [
  { id: 'kakao', label: '카카오 로그인', icon: '/images/social/kakao-symbol.svg', className: 'bg-[#FEE500] text-black/85 rounded-[12px]' },
  { id: 'naver', label: '네이버 로그인', image: '/images/social/naver-login-wide.png' },
  { id: 'google', label: 'Google 계정으로 로그인', icon: '/images/social/google-g.svg', className: 'bg-white text-[#1F1F1F] border border-[#747775] rounded-[4px]' },
];

// 로그인 탭 — 고른 역할이 계정에 없으면 로그인시키지 않고 안내 (요구사항: 역할 탭 UI · 역할 불일치 안내)
export const LOGIN_TABS = [
  { role: 'BUYER', label: '구매회원', home: '/' },
  { role: 'SELLER', label: '판매자', home: '/seller' },
  { role: 'ADMIN', label: '운영자', home: '/admin' },
];

export const roleMismatchMessage = (tab) => `${tab.label} 계정이 아니에요. 위에서 로그인 유형을 확인해주세요`;

// 로그인 실패 — 서버 메시지(ApiResponse.message)가 없을 때 (네트워크 · 타임아웃)
export const LOGIN_FALLBACK_MESSAGE = '로그인 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요';

// 소셜 로그인 결과 페이지 ?error= 코드 → 안내 문구 (백엔드 docs/api/error-codes.md)
const SOCIAL_ERROR_MESSAGES = {
  AUTH_EMAIL_DUPLICATE: '이미 가입된 이메일이에요. 탈퇴한 계정의 이메일은 다시 쓸 수 없어요',
  AUTH_ACCOUNT_DISABLED: '이용이 정지된 계정이에요. 고객센터로 문의해주세요',
  AUTH_SOCIAL_LOGIN_FAILED: '소셜 로그인에 실패했어요. 다시 시도해주세요',
  EXTERNAL_API_ERROR: '로그인 서버에 문제가 있어요. 잠시 후 다시 시도해주세요',
};

export const socialErrorMessage = (code) => SOCIAL_ERROR_MESSAGES[code] ?? SOCIAL_ERROR_MESSAGES.AUTH_SOCIAL_LOGIN_FAILED;

// 로그인 후 첫 화면 — 역할이 여럿이면 운영자 > 판매자 > 구매자
export const homePathFor = (roles = []) => {
  if (roles.includes('ADMIN')) return '/admin';
  if (roles.includes('SELLER')) return '/seller';
  return '/';
};
