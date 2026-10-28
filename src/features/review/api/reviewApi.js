// review 도메인 API — 담당 이경석
// 응답은 화면이 쓰던 목업 필드 이름으로 바꿔 넘긴다 (docs/MOCK-TO-API.md 2절) — 계약: backend docs/api/review.md
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { reviews, qnas } from '@/mocks/fixtures/reviews';

// TODO(이경석): 상품 상세 · 판매자 리뷰 관리 연동 때 GET /api/reviews?productId= · /api/seller/reviews 로 — 지금은 목업
export const fetchReviews = () => mockResolve(reviews);

// TODO(이경석): GET /api/products/{id}/inquiries · /api/inquiries/me · /api/seller/inquiries
export const fetchQnas = () => mockResolve(qnas);

// ── 마이페이지 리뷰 관리 (review.md 1 ~ 5 · 12절)

// GET /api/reviews/me — 내가 쓴 리뷰(삭제 제외 · 블라인드 포함) 최신순. 마이페이지는 한 화면에 다 보여 주므로 한 페이지(최대 50)
export const toMyReview = (r) => ({
  id: r.reviewId,
  lineId: r.orderItemId,
  productId: r.productId,
  productName: r.productName,
  option: r.optionName ?? '',
  thumbnail: r.thumbnailUrl,
  rating: r.rating,
  title: r.title ?? '',
  body: r.content,
  fit: r.fit, // SMALL · TRUE_TO_SIZE · LARGE · null — 문구는 FIT_LABELS
  blinded: r.blinded,
  reply: r.replyContent,
  date: new Date(r.createdAt),
  images: r.images, // [{ key, url }] — 수정 때 남길 사진은 key 를 그대로 보낸다
});

export const fetchMyReviews = async () =>
  (await axiosInstance.get('/api/reviews/me', { params: { page: 0, size: 50 } })).data.data.content.map(toMyReview);

// GET /api/reviews/me/writable — 구매확정 후 30일 안 · 리뷰 없는 상품주문, 기한 임박순
export const toWritable = (e) => ({
  lineId: e.orderItemId,
  productId: e.productId,
  productName: e.productName,
  option: e.optionName ?? '',
  thumbnail: e.thumbnailUrl,
  date: new Date(e.confirmedAt),
  expiresAt: new Date(e.expiresAt),
});

export const fetchWritableReviews = async () => (await axiosInstance.get('/api/reviews/me/writable')).data.data.map(toWritable);

// POST /api/reviews — { orderItemId, rating, title?, content, fit?, imageKeys? } → 201 { reviewId }
export const createReview = async (request) => (await axiosInstance.post('/api/reviews', request)).data.data;

// PUT /api/reviews/{id} — 통째로 교체 (imageKeys 를 비우면 사진 삭제). 블라인드면 409 REVIEW_BLINDED
export const updateReview = async (id, request) => (await axiosInstance.put(`/api/reviews/${id}`, request)).data.data;

// DELETE /api/reviews/{id} — 소프트 삭제, 같은 상품주문에 다시 쓸 수 없다
export const deleteReview = (id) => axiosInstance.delete(`/api/reviews/${id}`);

// POST /api/reviews/images/presign — [{ contentType, size }] 1~3개 → [{ key, uploadUrl, expiresAt }] (같은 순서)
export const presignReviewImages = async (files) =>
  (await axiosInstance.post('/api/reviews/images/presign', { files: files.map((f) => ({ contentType: f.type, size: f.size })) })).data.data;

// 사진을 S3 에 올리고 키를 돌려준다 — presigned PUT 은 우리 API 가 아니라 axiosInstance(토큰 헤더) 대신 fetch.
// Content-Type 이 서명에 들어가 있어 발급 때와 같아야 한다 (다르면 S3 403)
export async function uploadReviewImages(files) {
  if (files.length === 0) return [];
  const issued = await presignReviewImages(files);
  await Promise.all(issued.map(async ({ uploadUrl }, i) => {
    const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': files[i].type }, body: files[i] });
    if (!res.ok) throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.');
  }));
  return issued.map(({ key }) => key);
}
