// review 도메인 API — 담당 이경석
import { mockResolve } from '@/mocks/mockApi';
import { reviews, qnas } from '@/mocks/fixtures/reviews';

// TODO(이경석): 화면별로 GET /api/products/{id}/reviews · /api/reviews/me · /api/seller/reviews 로 나뉜다 — 목업은 전체를 돌려주고 화면에서 거름
export const fetchReviews = () => mockResolve(reviews);

// TODO(이경석): GET /api/products/{id}/inquiries · /api/inquiries/me · /api/seller/inquiries
export const fetchQnas = () => mockResolve(qnas);
