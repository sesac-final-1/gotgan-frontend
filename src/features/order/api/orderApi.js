// order 도메인 API — 담당 이경석
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { myOrders, sellerOrders } from '@/mocks/fixtures/orders';
import { users } from '@/mocks/fixtures/people';

// POST /api/orders — 주문서 제출 (ORD-03 · 04, 요청은 utils/orderRequest). 포인트 차감 · 재고 예약 · 결제 준비까지 서버 Saga
// → 201 { orderNo, status: PENDING(결제창 필요) | PAID(전액 포인트 0원), payAmt, portonePaymentId, orderName } — 그대로 payOrder 에 넘긴다
export const createOrder = async (request) => (await axiosInstance.post('/api/orders', request)).data.data;

// GET /api/orders — 내 주문 전체 (수백 건 이하라 1회 로드, 최신 먼저)
// → { statusCounts: { PAYMENT_DONE: n, ... 모든 상태 }, orders: [{ orderNo, status, payAmt, orderedAt, items[] }] }
export const fetchMyOrders = async () => (await axiosInstance.get('/api/orders')).data.data;

// GET /api/orders/{orderNo} — 상품주문별 상태 · 배송지 스냅샷 · 금액 · 포인트 · 결제(payment, 없으면 null). 남의 주문은 404
export const fetchMyOrder = async (orderNo) => (await axiosInstance.get(`/api/orders/${encodeURIComponent(orderNo)}`)).data.data;

// GET /api/orders/{orderNo}/claims/preview?orderItemId&type&reasonCode — 환불 예정액. 신청할 수 없으면 신청과 같은 409
// → { itemAmt, shippingFee(취소 +돌려받음 · 반품 −차감), sellerFault, refundAmt, restorePoint, reclaimPoint }
export const fetchClaimPreview = async (orderNo, params) =>
  (await axiosInstance.get(`/api/orders/${encodeURIComponent(orderNo)}/claims/preview`, { params })).data.data;

// POST /api/orders/{orderNo}/claims — { orderItemId, type, reasonCode, reasonDetail }
// 취소(CLM-01): 201 status COMPLETED(환불 끝) | APPROVED(환불 처리 중 — 서버가 마저 진행). 반품 · 교환: REQUESTED(판매자 확인 대기)
export const requestClaim = async (orderNo, request) =>
  (await axiosInstance.post(`/api/orders/${encodeURIComponent(orderNo)}/claims`, request)).data.data;

// TODO(이경석): 임시 — 클레임 내역 · 리뷰 작성 가능 목록은 아직 목업 (클레임 목록 · 리뷰 API 가 나오면 삭제)
export const fetchMyOrdersMock = () => mockResolve(myOrders);

// TODO(이경석): GET /api/seller/order-items?page&size&sort&status&q — 서버 페이징 대상(컨벤션 4-7). 목업은 전체를 돌려줌
export const fetchSellerOrderItems = () => mockResolve(sellerOrders);

// TODO(이경석): 임시 — 판매자 화면의 구매자 · 작성자 표시용. 실제로는 /api/seller/reviews · 문의 · 주문상세 응답에 작성자명(마스킹) · 구매자 요약을 담고, 이 함수와 useSellerBuyersQuery 는 삭제
export const fetchSellerBuyers = () => mockResolve(users);
