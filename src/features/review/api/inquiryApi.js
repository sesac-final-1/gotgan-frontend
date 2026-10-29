// 상품 문의 API — 담당 이경석. 계약: backend docs/api/review.md 13 ~ 20절
// 응답은 화면 필드 이름으로 바꿔 넘긴다 (docs/MOCK-TO-API.md 2절)
import { axiosInstance } from '@/shared/api/axiosInstance';
import { mockProductInquiryPage } from '@/mocks/productInquiries';

// TODO(박지연 · 이경석): 상품 상세가 목업 상품(id 'p101')을 쓰는 동안만 목업 문의로 — 실제 API 는 숫자 productId 만 받는다.
// 상품 상세를 실제 상품 API 로 바꾸면 이 분기와 mocks/productInquiries.js 를 삭제
const isMockProduct = (productId) => !/^\d+$/.test(String(productId));

const toDate = (iso) => (iso ? new Date(iso) : null);
const mapPage = (page, map) => ({ ...page, content: page.content.map(map) });

// GET /api/inquiries?productId — 공개. 볼 수 없는 비밀글은 content · answer 가 null, mine = 내 문의
export const toProductInquiry = (i) => ({
  id: i.inquiryId,
  writer: i.writerDisplayName,
  secret: i.secret,
  mine: i.mine,
  content: i.content,
  answered: i.answered,
  answer: i.answerContent,
  date: new Date(i.createdAt),
});

export const fetchProductInquiries = async (params) => mapPage(isMockProduct(params.productId)
  ? await mockProductInquiryPage(params)
  : (await axiosInstance.get('/api/inquiries', { params })).data.data, toProductInquiry);

// GET /api/inquiries/me — 내 문의(비밀글 · 답변 포함), 상품명 · 사진은 등록 시점 값
export const toMyInquiry = (i) => ({
  id: i.inquiryId,
  productId: i.productId,
  productName: i.productName,
  thumbnail: i.thumbnailUrl,
  content: i.content,
  secret: i.secret,
  answered: i.answerContent != null,
  answer: i.answerContent,
  answeredAt: toDate(i.answeredAt),
  date: new Date(i.createdAt),
});

export const fetchMyInquiries = async (params) =>
  mapPage((await axiosInstance.get('/api/inquiries/me', { params })).data.data, toMyInquiry);

// POST /api/inquiries — { productId, content(1~1,000자), secret } → 201 { inquiryId }
export const createInquiry = async (request) => (await axiosInstance.post('/api/inquiries', request)).data.data;

// PUT /api/inquiries/{id} — { content, secret } 통째로. 판매자 답변 뒤에는 409 INQUIRY_ALREADY_ANSWERED
export const updateInquiry = async (id, request) => (await axiosInstance.put(`/api/inquiries/${id}`, request)).data.data;

// DELETE /api/inquiries/{id} — 소프트 삭제, 답변 달린 문의도 가능
export const deleteInquiry = (id) => axiosInstance.delete(`/api/inquiries/${id}`);

// ── 판매자 (SELLER, 스토어 = 게이트웨이가 넣는 X-Store-Id)

// GET /api/seller/inquiries?tab=ALL|UNANSWERED|ANSWERED&page&size — 내 스토어 문의, 비밀글도 내용을 보여 준다
export const toSellerInquiry = (i) => ({
  id: i.inquiryId,
  productId: i.productId,
  productName: i.productName,
  writer: i.writerDisplayName,
  content: i.content,
  secret: i.secret,
  answer: i.answerContent,
  date: new Date(i.createdAt),
});

export const fetchSellerInquiries = async (params) =>
  mapPage((await axiosInstance.get('/api/seller/inquiries', { params })).data.data, toSellerInquiry);

// GET /api/seller/inquiries/summary — { unanswered, answered, all } (탭 숫자 · 메뉴 배지)
export const fetchSellerInquirySummary = async () => (await axiosInstance.get('/api/seller/inquiries/summary')).data.data;

// PUT /api/seller/inquiries/{id}/answer — 문의당 1개, 있으면 덮어씀
export const answerInquiry = async (id, content) => (await axiosInstance.put(`/api/seller/inquiries/${id}/answer`, { content })).data.data;
