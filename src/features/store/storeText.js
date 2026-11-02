// 스토어 표시 문구 — 담당 박지연
import { comma } from '@/shared/utils/format';

// 배송 한 줄 — 기본 배송비 0원 = 모든 주문 무료배송, 무료배송 기준은 있을 때만, 비어 있는 택배사는 뺀다(store.md 13-2)
export const shippingText = (s) => [
  s.courier,
  s.shipFee ? `${comma(s.shipFee)}원${s.freeOver ? ` (${comma(s.freeOver)}원 이상 무료)` : ''}` : '무료배송',
].filter(Boolean).join(' · ');
