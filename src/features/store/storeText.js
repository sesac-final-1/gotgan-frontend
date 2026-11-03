// 스토어 표시 문구 — 담당 박지연
import { comma } from '@/shared/utils/format';

// 배송 한 줄 — 기본 배송비 0원 = 모든 주문 무료배송, 무료배송 기준은 있을 때만, 비어 있는 택배사는 뺀다(store.md 13-2)
export const shippingText = (s) => [
  s.courier,
  s.shipFee ? `${comma(s.shipFee)}원${s.freeOver ? ` (${comma(s.freeOver)}원 이상 무료)` : ''}` : '무료배송',
].filter(Boolean).join(' · ');

// 스토어 소개는 HTML 로 저장된다(서버 정화, 신청 · 시드는 <p> 문단). 판매자 입력 칸은 태그 없는 글자로 보여 주고 저장할 때 다시 문단으로
// HTML → 입력 칸 글자: 문단 · 줄바꿈은 줄로 바꾸고 그 밖의 태그는 버린다(굵게 · 링크 같은 서식은 사라짐)
export function introToText(html) {
  if (!html) return '';
  const lined = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  return new DOMParser().parseFromString(lined, 'text/html').body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// 입력 칸 글자 → 저장할 HTML: 줄마다 <p>, 빈 줄은 건너뜀, 글자 속 < > & 는 글자 그대로 보이게. 내용이 없으면 null(소개 없음)
export function textToIntro(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines.map((line) => `<p>${line.replace(/[&<>"']/g, (c) => ESCAPE[c])}</p>`).join('') : null;
}
