// order 도메인 API — 담당 이경석
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { myOrders, sellerOrders } from '@/mocks/fixtures/orders';
import { users } from '@/mocks/fixtures/people';

// POST /api/orders — 주문서 제출 (ORD-03 · 04, 요청은 utils/orderRequest). 포인트 차감 · 재고 예약 · 결제 준비까지 서버 Saga
// → 201 { orderNo, status: PENDING(결제창 필요) | PAID(전액 포인트 0원), payAmt, portonePaymentId, orderName } — 그대로 payOrder 에 넘긴다
export const createOrder = async (request) => (await axiosInstance.post('/api/orders', request)).data.data;

// TODO(이경석): GET /api/orders (내 주문 — 수백 건 이하라 전체 1회 로드)
export const fetchMyOrders = () => mockResolve(myOrders);

// TODO(이경석): GET /api/seller/order-items?page&size&sort&status&q — 서버 페이징 대상(컨벤션 4-7). 목업은 전체를 돌려줌
export const fetchSellerOrderItems = () => mockResolve(sellerOrders);

// TODO(이경석): 임시 — 판매자 화면의 구매자 · 작성자 표시용. 실제로는 /api/seller/reviews · 문의 · 주문상세 응답에 작성자명(마스킹) · 구매자 요약을 담고, 이 함수와 useSellerBuyersQuery 는 삭제
export const fetchSellerBuyers = () => mockResolve(users);
