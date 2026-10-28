// 리뷰 — 담당 이경석. 서버 규칙(backend docs/api/review.md 1 · 12절)과 같은 값

// 사이즈 체감 — 서버 enum ↔ 화면 문구
export const FIT_LABELS = { SMALL: '작아요', TRUE_TO_SIZE: '정사이즈', LARGE: '커요' };
export const FITS = Object.keys(FIT_LABELS);

export const CONTENT_MIN = 20;
export const CONTENT_MAX = 2000;

// 사진 — 리뷰당 최대 3장 · JPG / PNG / WEBP · 10MB 이하 (presign 이 같은 규칙으로 검사)
export const MAX_IMAGES = 3;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
