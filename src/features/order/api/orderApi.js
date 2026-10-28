// order 도메인 API — 담당 이경석
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockResolve } from '@/mocks/mockApi';
import { sellerOrders } from '@/mocks/fixtures/orders';
import { users } from '@/mocks/fixtures/people';

// GET /api/carts — 장바구니 (스토어별 묶음 · 배송비 · 무료배송까지 남은 금액, 가격 · 품절은 product 재확인)
// → { stores[{ storeId, storeName, productAmt, shippingFee, freeThreshold, amountToFree, items[] }], unavailable[], cartCount, checkedCount,
//     totalProductAmt, totalShippingFee, totalAmt } — 금액은 선택된 구매 가능 줄만
export const fetchCart = async () => (await axiosInstance.get('/api/carts')).data.data;

// POST /api/carts/items — [{ productOptionId, quantity }] 담기 (담긴 옵션은 수량 합산)
export const addCartItems = async (items) => (await axiosInstance.post('/api/carts/items', { items })).data.data;

// DELETE /api/carts/items?productOptionIds=11,12 — 단건 · 선택 삭제
export const removeCartItems = async (productOptionIds) =>
  (await axiosInstance.delete('/api/carts/items', { params: { productOptionIds: productOptionIds.join(',') } })).data.data;

// PATCH /api/carts/items/{productOptionId} — { quantity?, checked? } 보낸 것만
export const updateCartItem = async (productOptionId, change) =>
  (await axiosInstance.patch(`/api/carts/items/${productOptionId}`, change)).data.data;

// PATCH /api/carts/items/checked — 선택 한꺼번에 (productOptionIds 없으면 전체)
export const checkCartItems = async (checked, productOptionIds) =>
  (await axiosInstance.patch('/api/carts/items/checked', { checked, productOptionIds })).data.data;

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

// GET /api/seller/order-items?status&q&page&size — 판매자 주문 목록 (서버 페이징, 최신 주문 먼저 · 결제 전 제외)
// → { statusCounts: { PAYMENT_DONE: n, ... }, items: { content[], page, size, totalElements, totalPages, hasNext } }
export const fetchSellerOrderItems = async (params) => (await axiosInstance.get('/api/seller/order-items', { params })).data.data;

// GET /api/seller/order-items/{orderItemId} — 상세. 남의 스토어 · 결제 전은 404
export const fetchSellerOrderItem = async (orderItemId) => (await axiosInstance.get(`/api/seller/order-items/${orderItemId}`)).data.data;

// PATCH /api/seller/order-items/confirm · ship · deliver — 일괄 처리, 상품주문마다 따로라 일부만 실패할 수 있다
// → { succeeded[], failed[{ orderItemId, code, message }] } (failed 가 있어도 200)
export const confirmOrderItems = async (orderItemIds) =>
  (await axiosInstance.patch('/api/seller/order-items/confirm', { orderItemIds })).data.data;
// items: [{ orderItemId, courier, trackingNo }] — trackingNo 를 비우면(null) 서버가 mock 송장번호
export const shipOrderItems = async (items) => (await axiosInstance.patch('/api/seller/order-items/ship', { items })).data.data;
export const deliverOrderItems = async (orderItemIds) =>
  (await axiosInstance.patch('/api/seller/order-items/deliver', { orderItemIds })).data.data;

// POST /api/orders/{orderNo}/items/{orderItemId}/confirm — 구매확정 (배송완료만, 확정 후 반품 · 교환 불가) → 상품주문
export const confirmPurchase = async (orderNo, orderItemId) =>
  (await axiosInstance.post(`/api/orders/${encodeURIComponent(orderNo)}/items/${orderItemId}/confirm`)).data.data;

// PATCH /api/claims/{claimId}/withdraw — 반품 · 교환 철회 (판매자 승인 전만) → 클레임(WITHDRAWN)
export const withdrawClaim = async (claimId) => (await axiosInstance.patch(`/api/claims/${claimId}/withdraw`)).data.data;

// GET /api/claims — 내 클레임 전체(최신 먼저) → [{ claimId, type, status, reasonCode, reasonDetail, rejectReason, refundAmt, restorePoint,
//   requestedAt, processedAt, orderItemId, itemNo, orderNo, productName, optionName, thumbnailUrl, quantity, itemAmt, itemStatus, courier, trackingNo }]
export const fetchMyClaims = async () => (await axiosInstance.get('/api/claims')).data.data;

// GET /api/seller/claims?stage(OPEN|DONE)&type&page&size — 판매자 클레임 (서버 페이징) → { stageCounts, typeCounts, items(페이지) }
export const fetchSellerClaims = async (params) => (await axiosInstance.get('/api/seller/claims', { params })).data.data;

// PATCH /api/seller/claims/{id}/… — 승인(반품 · 교환 → 수거 요청) · 거부(사유) · 수거 완료(반품은 이어서 환불) · 교환 재배송 송장 → 처리 뒤 클레임
export const approveClaim = async (claimId) => (await axiosInstance.patch(`/api/seller/claims/${claimId}/approve`)).data.data;
export const rejectClaim = async (claimId, reason) => (await axiosInstance.patch(`/api/seller/claims/${claimId}/reject`, { reason })).data.data;
export const collectClaim = async (claimId) => (await axiosInstance.patch(`/api/seller/claims/${claimId}/collect`)).data.data;
// { courier, trackingNo } — trackingNo 를 비우면(null) 서버가 mock 송장번호. 재배송의 배송완료는 주문 관리의 배송완료(또는 자동)
export const reshipClaim = async (claimId, request) => (await axiosInstance.patch(`/api/seller/claims/${claimId}/reship`, request)).data.data;

// TODO(이경석): 임시 — 판매자 대시보드 최근 주문은 아직 목업 (대시보드 연동 때 삭제)
export const fetchSellerOrderItemsMock = () => mockResolve(sellerOrders);

// TODO(이경석): 임시 — 판매자 화면의 구매자 · 작성자 표시용. 실제로는 /api/seller/reviews · 문의 · 주문상세 응답에 작성자명(마스킹) · 구매자 요약을 담고, 이 함수와 useSellerBuyersQuery 는 삭제
export const fetchSellerBuyers = () => mockResolve(users);
