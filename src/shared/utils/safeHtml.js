// 판매자가 쓴 HTML(상품 설명 · 스토어 소개 · 입점 소개) 표시용 — 서버 OWASP 정화를 거친 값도 화면에 넣기 전에 한 번 더 (2중 방어, SYS-07)
// 사용: <div dangerouslySetInnerHTML={safeHtml(html)} /> — dangerouslySetInnerHTML 에는 이 함수를 거친 값만 넣는다
import DOMPurify from 'dompurify';

// 서식 · 문단 · 링크 · 이미지 · 표만 (서버 정책과 같은 범위). 스크립트 · 이벤트 속성 · javascript: 링크는 DOMPurify 기본으로 제거
const OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style'],
};

// 링크는 새 탭 + 연 페이지가 곳간 탭을 조작하지 못하게(opener 차단)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const sanitizeHtml = (html) => (html ? DOMPurify.sanitize(html, OPTIONS) : '');
export const safeHtml = (html) => ({ __html: sanitizeHtml(html) });
