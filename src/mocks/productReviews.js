// TODO(박지연 · 이경석): 임시 — 상품 상세가 목업 상품(id 'p101' 같은 문자열)을 쓰는 동안만 쓴다.
// 실제 리뷰 API 는 숫자 productId 만 받으므로, 목업 상품이면 목업 리뷰를 API 응답 모양으로 바꿔 돌려준다.
// 상품 상세를 실제 상품 API 로 바꾸면: 이 파일 삭제 + features/review/api/reviewApi.js 의 isMockProduct 분기 삭제
import { mockResolve } from '@/mocks/mockApi';
import { reviews } from '@/mocks/fixtures/reviews';

const FIT_CODE = { 작아요: 'SMALL', 정사이즈: 'TRUE_TO_SIZE', 커요: 'LARGE' };
const SORTS = { LATEST: (a, b) => b.date - a.date, RATING_HIGH: (a, b) => b.rating - a.rating || b.date - a.date, RATING_LOW: (a, b) => a.rating - b.rating || b.date - a.date };

const visible = (productId) => reviews.filter((r) => r.productId === productId && !r.blinded);
const toResponse = (r) => ({
  reviewId: r.id, writerDisplayName: '구매자', rating: r.rating, title: r.title, content: r.body, optionName: r.option || null,
  fit: FIT_CODE[r.fit] ?? null, replyContent: r.reply, repliedAt: null, createdAt: r.date.toISOString(), imageUrls: r.photos,
});

// GET /api/reviews 흉내 — rating · photoOnly 필터, sort, page · size
export function mockProductReviewPage({ productId, rating, photoOnly, sort = 'LATEST', page = 0, size = 10 }) {
  const all = visible(productId).filter((r) => (!rating || r.rating === rating) && (!photoOnly || r.photos.length)).sort(SORTS[sort]);
  const totalPages = Math.ceil(all.length / size);
  return mockResolve({
    content: all.slice(page * size, (page + 1) * size).map(toResponse),
    page, size, totalElements: all.length, totalPages, hasNext: page + 1 < totalPages,
  });
}

// GET /api/reviews/summary 흉내
export function mockProductReviewSummary(productId) {
  const all = visible(productId);
  const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
  return mockResolve({
    averageRating: Math.round(avg * 100) / 100,
    reviewCount: all.length,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: all.filter((r) => r.rating === rating).length })),
    fits: Object.entries(FIT_CODE).map(([label, fit]) => ({ fit, count: all.filter((r) => r.fit === label).length })),
  });
}
