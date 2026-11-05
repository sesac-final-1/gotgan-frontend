// 이미지 로드 실패 → 대체 이미지 — 담당 구지훈. S3 가 죽어도 깨진 그림 대신 정적 파일(Vercel)을 보여 준다 (멘토링 F-2)
// <img> 가 화면마다 흩어져 있어 문서 전체에서 한 번에 받는다 — error 는 버블링되지 않아 capture 로 잡는다
// 종류는 속성으로 고른다: data-cat={상위 카테고리 id} · data-fallback="store" | "avatar" — 없으면 기본 이미지
const BASE = '/images/fallback/';
// 상위 카테고리 id — 시드 productdb (1 식품 · 2 리빙 · 3 패션의류 · 4 신발 · 가방 · 5 뷰티 · 6 디지털)
const CATEGORY_FILES = { 1: 'food', 2: 'living', 3: 'fashion', 4: 'shoes', 5: 'beauty', 6: 'digital' };
const KIND_FILES = { store: 'store', avatar: 'avatar' };

export const fallbackSrc = ({ cat, fallback } = {}) =>
  `${BASE}${KIND_FILES[fallback] ?? CATEGORY_FILES[cat] ?? 'default'}.svg`;

export function handleImageError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return; // script · link 등 다른 요소의 error 도 여기로 온다
  if (img.getAttribute('src')?.startsWith(BASE)) return; // 대체 이미지까지 실패하면 멈춘다(무한 반복 방지)
  img.removeAttribute('srcset');
  img.src = fallbackSrc(img.dataset);
}

export function installImageFallback(root = document) {
  root.addEventListener('error', handleImageError, true);
  return () => root.removeEventListener('error', handleImageError, true);
}
