// TODO(박지연 · 이경석): 임시 — 상품 상세가 목업 상품(id 'p101' 같은 문자열)을 쓰는 동안만 쓴다.
// 실제 문의 API 는 숫자 productId 만 받으므로, 목업 상품이면 목업 문의를 API 응답 모양으로 바꿔 돌려준다.
// 상품 상세를 실제 상품 API 로 바꾸면: 이 파일 삭제 + features/review/api/inquiryApi.js 의 isMockProduct 분기 삭제
import { mockResolve } from '@/mocks/mockApi';
import { qnas } from '@/mocks/fixtures/reviews';

// GET /api/inquiries 흉내 — 비로그인 기준(비밀글은 내용 · 답변 null), 최신순 · page · size
export function mockProductInquiryPage({ productId, page = 0, size = 10 }) {
  const all = qnas.filter((q) => q.productId === productId).sort((a, b) => b.date - a.date);
  const totalPages = Math.ceil(all.length / size);
  return mockResolve({
    content: all.slice(page * size, (page + 1) * size).map((q) => ({
      inquiryId: q.id, writerDisplayName: '구매자', secret: q.secret, mine: false,
      content: q.secret ? null : q.q, answered: !!q.a, answerContent: q.secret ? null : q.a,
      answeredAt: q.a ? q.date.toISOString() : null, createdAt: q.date.toISOString(),
    })),
    page, size, totalElements: all.length, totalPages, hasNext: page + 1 < totalPages,
  });
}
