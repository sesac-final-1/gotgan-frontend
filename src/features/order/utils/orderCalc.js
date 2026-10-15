// 주문 금액 · 포인트 · 배송 추적 계산 — 지금은 목업 데이터에서 계산한다 (담당 이경석)
// ⚠ API 가 준비되면 이 값들은 주문 응답 DTO 의 필드(goods · ship · used · paid · earned · tracking[])로 받는다
//   → 화면은 응답 필드를 쓰도록 바꾸고 이 파일은 삭제 (docs/MOCK-TO-API.md "계산 필드")
export { orderTotal, shipFeeFor, orderShip, orderPay, linePoints, trackingOf, orderOfLine } from '@/mocks/fixtures/orders';
