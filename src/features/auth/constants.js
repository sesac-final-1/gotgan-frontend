// 인증 상수 — 담당 이경석

// 소셜 로그인 제공자 — id 는 백엔드 /api/auth/social/{id} 의 alias
export const SOCIAL_PROVIDERS = [
  { id: 'kakao', label: '카카오로 시작하기' },
  { id: 'naver', label: '네이버로 시작하기' },
  { id: 'google', label: 'Google로 시작하기' },
];

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
